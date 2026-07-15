/**
 * cleanupOrphanedCloudinaryFiles.js
 * ---------------------------------
 * One-time (or occasional) maintenance script: finds every file sitting in
 * this project's Cloudinary account that is NOT referenced by any current
 * database record, and — only if you pass --delete — removes it.
 *
 * Why this is needed: the app previously had several places where deleting
 * something in the app (a class, a student, an assignment, a chat message,
 * the school logo) did not also delete its file from Cloudinary. Those
 * code paths are now fixed, but files that already leaked BEFORE the fix
 * are still sitting in your Cloudinary storage. This script finds and
 * clears those out.
 *
 * USAGE:
 *   node scripts/cleanupOrphanedCloudinaryFiles.js            # dry run — lists orphans only, deletes nothing
 *   node scripts/cleanupOrphanedCloudinaryFiles.js --delete    # actually deletes the orphans it finds
 *
 * Always run WITHOUT --delete first and read the output before re-running
 * with --delete. This action is irreversible.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { cloudinary } = require('../middleware/upload');
const {
  Document, Assignment, Submission, ReportConfig, DiscussionGroup, DirectMessage,
} = require('../models/db');

const DO_DELETE = process.argv.includes('--delete');

// Cloudinary folders this app uploads into, and which resource_type(s) each
// one can contain (must match middleware/upload.js exactly).
const FOLDERS = [
  { prefix: 'edupla/documents',    resourceTypes: ['raw', 'image'] }, // PDFs are stored as 'image' (see upload.js comment)
  { prefix: 'edupla/assignments',  resourceTypes: ['raw', 'image'] }, // shared by assignment files AND student submissions
  { prefix: 'edupla/voice_notes',  resourceTypes: ['raw'] },
  { prefix: 'edupla/report_logos', resourceTypes: ['image'] },
  { prefix: 'edupla/chat_media',   resourceTypes: ['raw', 'image'] },
];

async function listAllCloudinaryResources(prefix, resourceType) {
  let resources = [];
  let nextCursor = undefined;
  do {
    const res = await cloudinary.api.resources({
      type: 'upload',
      resource_type: resourceType,
      prefix,
      max_results: 500,
      next_cursor: nextCursor,
    });
    resources = resources.concat(res.resources);
    nextCursor = res.next_cursor;
  } while (nextCursor);
  return resources;
}

async function getReferencedPublicIds() {
  const referenced = new Set();

  const [docs, assignments, submissions, reportConfigs, groups, dms] = await Promise.all([
    Document.find({}, 'filename').lean(),
    Assignment.find({}, 'filename').lean(),
    Submission.find({}, 'filename').lean(),
    ReportConfig.find({}, 'schoolLogoPublicId').lean(),
    DiscussionGroup.find({}, 'messages.media_public_id').lean(),
    DirectMessage.find({}, 'media_public_id').lean(),
  ]);

  docs.forEach(d => d.filename && referenced.add(d.filename));
  assignments.forEach(a => a.filename && referenced.add(a.filename));
  submissions.forEach(s => s.filename && referenced.add(s.filename));
  reportConfigs.forEach(c => c.schoolLogoPublicId && referenced.add(c.schoolLogoPublicId));
  groups.forEach(g => (g.messages || []).forEach(m => m.media_public_id && referenced.add(m.media_public_id)));
  dms.forEach(m => m.media_public_id && referenced.add(m.media_public_id));

  return referenced;
}

async function main() {
  console.log(DO_DELETE ? 'Running in DELETE mode — orphans will be removed.' : 'Running in DRY-RUN mode — nothing will be deleted.');
  console.log('');

  await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.DB_NAME });
  const referenced = await getReferencedPublicIds();
  console.log(`Found ${referenced.size} file(s) referenced by the database.\n`);

  let totalOrphans = 0;
  let totalBytes = 0;

  for (const folder of FOLDERS) {
    for (const resourceType of folder.resourceTypes) {
      const resources = await listAllCloudinaryResources(folder.prefix, resourceType);
      const orphans = resources.filter(r => !referenced.has(r.public_id));

      if (orphans.length === 0) continue;

      console.log(`${folder.prefix} (${resourceType}): ${orphans.length} orphan(s) of ${resources.length} total`);
      for (const o of orphans) {
        const sizeMB = (o.bytes / (1024 * 1024)).toFixed(2);
        console.log(`  - ${o.public_id}  (${sizeMB} MB, uploaded ${o.created_at})`);
        totalBytes += o.bytes || 0;
      }
      totalOrphans += orphans.length;

      if (DO_DELETE && orphans.length > 0) {
        const publicIds = orphans.map(o => o.public_id);
        await cloudinary.api.delete_resources(publicIds, { resource_type: resourceType });
        console.log(`  → deleted ${publicIds.length} file(s) from ${folder.prefix} (${resourceType})`);
      }
    }
  }

  console.log('');
  console.log(`Total orphaned files found: ${totalOrphans}`);
  console.log(`Total orphaned storage: ${(totalBytes / (1024 * 1024)).toFixed(2)} MB`);
  if (!DO_DELETE && totalOrphans > 0) {
    console.log('\nThis was a dry run — nothing was deleted. Re-run with --delete to actually remove these files.');
  }

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Cleanup script failed:', err);
  process.exit(1);
});
