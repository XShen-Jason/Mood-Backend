/**
 * Template routes
 * POST /api/template/upload  — Upload a new template (multipart/form-data)
 * GET  /api/template/list    — List all registered templates
 * GET  /api/template/preview/:name — Preview a template with default data
 */
const express = require('express');
const multer = require('multer');
const { requireAdmin } = require('../middleware/auth');
const { r2Put, r2Get } = require('../utils/r2');
const { kvGet, kvPut, kvList } = require('../utils/kv');
const { makeVersion } = require('../utils/mime');
const { injectData } = require('../utils/html');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

let cachedTemplates = null;

// ── POST /api/template/upload ─────────────────────────────────────────────────
router.post('/upload', requireAdmin, upload.any(), async (req, res) => {
    try {
        const templateName = (req.body.templateName ?? '').trim();
        if (!templateName || !/^[a-z0-9_]+$/.test(templateName)) {
            return res.status(400).json({
                error: 'templateName must contain only lowercase letters, numbers, or underscores',
            });
        }

        const files = req.files ?? [];
        if (!files.some((f) => f.fieldname === 'index.html')) {
            return res.status(400).json({ error: 'index.html is required' });
        }

        const version = makeVersion();
        const uploadedFiles = [];

        // Write every uploaded file to R2 under versioned path
        for (const file of files) {
            const r2Key = `templates/${templateName}/${version}/${file.fieldname}`;
            await r2Put(r2Key, file.buffer, file.mimetype);
            uploadedFiles.push(file.fieldname);
        }

        // Parse schema if present
        let fields = [];
        let isStatic = true;
        const schemaFile = files.find((f) => f.fieldname === 'schema.json');
        if (schemaFile) {
            const schema = JSON.parse(schemaFile.buffer.toString('utf-8'));
            fields = (schema.fields ?? []).map((f) => f.key ?? f);
            isStatic = schema.static === true || fields.length === 0;
        }

        // Register / update template metadata in KV
        await kvPut(`__tmpl__${templateName}`, {
            name: templateName,
            version,
            fields,
            static: isStatic,
            updatedAt: new Date().toISOString(),
        });

        // Invalidate the in-memory template list cache
        cachedTemplates = null;

        // TODO (P2): async re-render old user pages that use this template
        // For now we log it; BullMQ / worker job to be added later
        // (Legacy KV index removed - future implementation should query Supabase)

        return res.json({
            success: true,
            templateName,
            version,
            fields,
            static: isStatic,
            filesUploaded: uploadedFiles,
            previewUrl: `https://www.885201314.xyz/preview/${templateName}`,
        });
    } catch (err) {
        console.error('[template/upload]', err);
        return res.status(500).json({ error: err.message });
    }
});

// ── GET /api/template/list ────────────────────────────────────────────────────
router.get('/list', async (_req, res) => {
    try {
        if (!cachedTemplates) {
            const keys = await kvList('__tmpl__');
            const metas = await Promise.all(keys.map((k) => kvGet(k)));
            cachedTemplates = metas.filter(Boolean);
            console.log(`[template/list] Cache MISS: Loaded ${cachedTemplates.length} templates from KV.`);
        }

        res.set('Cache-Control', 'public, max-age=60'); // Browser caches for 1 minute
        return res.json({ success: true, templates: cachedTemplates });
    } catch (err) {
        console.error('[template/list]', err);
        return res.status(500).json({ error: err.message });
    }
});

// ── GET /api/template/raw/:name ──────────────────────────────────────────────
router.get('/raw/:name', async (req, res) => {
    try {
        const { name } = req.params;
        const meta = await kvGet(`__tmpl__${name}`);
        if (!meta) return res.status(404).json({ error: `Template '${name}' not found` });

        const htmlBuf = await r2Get(`templates/${name}/${meta.version}/index.html`);
        if (!htmlBuf) return res.status(404).json({ error: 'Template HTML missing in R2' });

        res.set('Cache-Control', 'public, max-age=3600');
        res.set('Content-Type', 'text/plain;charset=UTF-8');
        return res.send(htmlBuf.toString('utf-8'));
    } catch (err) {
        console.error('[template/raw]', err);
        return res.status(500).json({ error: err.message });
    }
});

// ── GET /api/template/preview/:name ──────────────────────────────────────────
router.get('/preview/:name', async (req, res) => {
    try {
        const { name } = req.params;
        const meta = await kvGet(`__tmpl__${name}`);
        if (!meta) return res.status(404).send('Template not found');

        const [htmlBuf, schemaBuf] = await Promise.all([
            r2Get(`templates/${name}/${meta.version}/index.html`),
            r2Get(`templates/${name}/${meta.version}/schema.json`),
        ]);

        if (!htmlBuf) return res.status(404).send('Template HTML missing');

        let html = htmlBuf.toString('utf-8');
        let schema = null;
        if (schemaBuf) {
            try { schema = JSON.parse(schemaBuf.toString('utf-8')); } catch (e) { /* ignore */ }
        }

        // 1. Inject <base> tag so relative assets (CSS/JS) load from the versions path in CDN
        // Note: Deployment guide suggests assets are served from /assets/:name/ which maps to R2
        const baseTag = `<base href="https://www.885201314.xyz/assets/${name}/" />`;
        html = html.replace('<head>', `<head>\n  ${baseTag}`);

        // 2. Inject default data from schema
        const rendered = injectData(html, {}, schema);

        res.set('Content-Type', 'text/html; charset=utf-8');
        return res.send(rendered);
    } catch (err) {
        console.error('[template/preview]', err);
        return res.status(500).send('Internal Server Error');
    }
});

module.exports = router;
