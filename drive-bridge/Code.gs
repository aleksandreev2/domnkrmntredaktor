/**
 * Google Apps Script bridge for Редактура «Дом Некроманта».
 * Required Script Properties: SOURCE_FOLDER_ID, COMMUNITY_FOLDER_ID, BRIDGE_SECRET.
 * Enable Advanced Drive service (Drive API v3) for DOCX conversion.
 */
function doGet() {
  return json_({ ok: true, service: 'domnkrmntredaktor-drive-bridge' });
}

function doPost(e) {
  try {
    var envelope = JSON.parse(e.postData.contents || '{}');
    verifyEnvelope_(envelope);
    var result = dispatch_(envelope.action, envelope.payload || {});
    return json_({ ok: true, result: result });
  } catch (err) {
    return json_({ ok: false, error: err && err.message ? err.message : String(err) });
  }
}

function dispatch_(action, payload) {
  switch (action) {
    case 'ping': return { pong: true, now: new Date().toISOString() };
    case 'listWorks': return listWorks_();
    case 'listChapters': return listChapters_(payload.workFolderId);
    case 'getChapter': return getChapter_(payload.fileId);
    case 'writeSuggestion': return writeSuggestion_(payload);
    default: throw new Error('Unknown action: ' + action);
  }
}

function verifyEnvelope_(envelope) {
  var props = PropertiesService.getScriptProperties();
  var secret = props.getProperty('BRIDGE_SECRET');
  if (!secret) throw new Error('BRIDGE_SECRET is not configured');
  var timestamp = String(envelope.timestamp || '');
  var nonce = String(envelope.nonce || '');
  var action = String(envelope.action || '');
  var signature = String(envelope.signature || '');
  var now = Math.floor(Date.now() / 1000);
  var ts = Number(timestamp);
  if (!ts || Math.abs(now - ts) > 300) throw new Error('Expired request');
  if (!nonce || nonce.length > 128) throw new Error('Invalid nonce');
  var cache = CacheService.getScriptCache();
  if (cache.get('nonce:' + nonce)) throw new Error('Replay detected');
  var payloadJson = JSON.stringify(envelope.payload || {});
  var canonical = action + '\n' + timestamp + '\n' + nonce + '\n' + payloadJson;
  var bytes = Utilities.computeHmacSha256Signature(canonical, secret, Utilities.Charset.UTF_8);
  var expected = Utilities.base64EncodeWebSafe(bytes).replace(/=+$/g, '');
  if (!constantTimeEqual_(expected, signature)) throw new Error('Invalid signature');
  cache.put('nonce:' + nonce, '1', 360);
}

function constantTimeEqual_(a, b) {
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function listWorks_() {
  var root = getRequiredFolder_('SOURCE_FOLDER_ID');
  var folders = root.getFolders();
  var out = [];
  while (folders.hasNext()) {
    var folder = folders.next();
    out.push({ id: folder.getId(), name: folder.getName() });
  }
  out.sort(function(a, b) { return a.name.localeCompare(b.name, 'ru'); });
  return out;
}

function listChapters_(workFolderId) {
  if (!workFolderId) throw new Error('workFolderId is required');
  var folder = DriveApp.getFolderById(workFolderId);
  var files = folder.getFiles();
  var out = [];
  while (files.hasNext()) {
    var file = files.next();
    var name = file.getName();
    if (!/\.(txt|docx)$/i.test(name)) continue;
    out.push({ id: file.getId(), name: name, mimeType: file.getMimeType(), modifiedAt: file.getLastUpdated().toISOString(), size: file.getSize() });
  }
  out.sort(function(a, b) { return naturalChapterNumber_(a.name) - naturalChapterNumber_(b.name) || a.name.localeCompare(b.name, 'ru'); });
  return out;
}

function getChapter_(fileId) {
  if (!fileId) throw new Error('fileId is required');
  var file = DriveApp.getFileById(fileId);
  var name = file.getName();
  var lower = name.toLowerCase();
  var text;
  var format;
  if (lower.endsWith('.txt')) {
    text = file.getBlob().getDataAsString('UTF-8');
    format = 'txt';
  } else if (lower.endsWith('.docx')) {
    text = docxToText_(file);
    format = 'docx';
  } else {
    throw new Error('Unsupported chapter format');
  }
  return { id: file.getId(), name: name, format: format, modifiedAt: file.getLastUpdated().toISOString(), text: normalizeText_(text) };
}

function docxToText_(file) {
  var temp = Drive.Files.create({ name: 'tmp-editor-' + file.getName(), mimeType: 'application/vnd.google-apps.document' }, file.getBlob(), { fields: 'id' });
  try {
    return DocumentApp.openById(temp.id).getBody().getText();
  } finally {
    Drive.Files.remove(temp.id);
  }
}

function writeSuggestion_(payload) {
  var workName = cleanName_(payload.workName || 'Без названия');
  var chapterName = cleanName_(payload.chapterName || 'Глава');
  var fileName = cleanName_(payload.fileName || ('suggestion-' + Date.now() + '.txt'));
  if (!fileName.toLowerCase().endsWith('.txt')) fileName += '.txt';
  if (typeof payload.content !== 'string') throw new Error('content is required');
  var root = getRequiredFolder_('COMMUNITY_FOLDER_ID');
  var workFolder = getOrCreateFolder_(root, workName);
  var chapterFolder = getOrCreateFolder_(workFolder, chapterName);
  var file = chapterFolder.createFile(fileName, payload.content, MimeType.PLAIN_TEXT);
  return { id: file.getId(), name: file.getName(), url: file.getUrl() };
}

function getRequiredFolder_(propertyName) {
  var id = PropertiesService.getScriptProperties().getProperty(propertyName);
  if (!id) throw new Error(propertyName + ' is not configured');
  return DriveApp.getFolderById(id);
}
function getOrCreateFolder_(parent, name) {
  var existing = parent.getFoldersByName(name);
  return existing.hasNext() ? existing.next() : parent.createFolder(name);
}
function cleanName_(value) {
  return String(value).replace(/[\\/:*?"<>|\u0000-\u001F]/g, '_').trim().slice(0, 160) || 'Без названия';
}
function naturalChapterNumber_(name) {
  var match = String(name).match(/\d+(?:[.,]\d+)?/);
  return match ? Number(match[0].replace(',', '.')) : Number.MAX_SAFE_INTEGER;
}
function normalizeText_(text) {
  return String(text).replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').trim();
}
function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
