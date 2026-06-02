const express = require('express');
const router = express.Router();
const { isAuthenticated, isTeacher } = require('../middleware/auth');
const { documentUpload } = require('../middleware/upload');
const { getDocuments, uploadDocument, updateDocument, deleteDocument, downloadDocument, viewDocument } = require('../controllers/documentController');

router.get('/', isAuthenticated, getDocuments);
router.post('/', isAuthenticated, isTeacher, documentUpload.single('file'), uploadDocument);
router.put('/:id', isAuthenticated, isTeacher, updateDocument);
router.delete('/:id', isAuthenticated, isTeacher, deleteDocument);
router.get('/:id/download', isAuthenticated, downloadDocument);
router.get('/:id/view', isAuthenticated, viewDocument);

module.exports = router;
