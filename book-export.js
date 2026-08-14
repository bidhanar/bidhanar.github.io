/* book-export.js — Download PDF + Download ePub for story/poem pages.
   Works for both the <p>-based bodies (.story-body, .poem-body) and the
   plain pre-wrap text bodies (.poem-text) used across the site.

   PDF: rendered from a clean, light, print-only clone of the content —
   NOT the live dark-themed card — so the export doesn't drag in the
   site's buttons/shadows/gradients or dump white-on-dark ink onto paper,
   and paragraphs are marked page-break-inside:avoid so they don't get
   guillotined across page boundaries. Still canvas-rendered (html2pdf/
   html2canvas) rather than vector text, because several poems are in
   Hindi and jsPDF's built-in fonts can't draw Devanagari glyphs at all —
   a screenshot-based render handles any script correctly.

   ePub: a real, minimal, valid EPUB3 file built client-side with JSZip.
   No font embedding needed — e-readers supply their own Unicode fonts,
   so Devanagari just works. */
(function () {
  function extractBody(body) {
    if (body.classList.contains('poem-text')) {
      var lines = body.textContent.replace(/\r/g, '').split('\n').map(function (l) { return l.trim(); });
      while (lines.length && !lines[0]) lines.shift();
      while (lines.length && !lines[lines.length - 1]) lines.pop();
      return { lines: lines, isPoem: true };
    }
    var ps = body.querySelectorAll('p');
    if (ps.length) {
      var out = [];
      Array.prototype.forEach.call(ps, function (p) {
        var html = p.innerHTML.replace(/<br\s*\/?>/gi, '\n');
        var tmp = document.createElement('div');
        tmp.innerHTML = html;
        var text = tmp.textContent.replace(/\r/g, '').trim();
        if (text) out.push(text);
      });
      return { lines: out, isPoem: body.classList.contains('poem-body') };
    }
    var raw = body.textContent.replace(/\r/g, '').split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
    return { lines: raw, isPoem: false };
  }

  function getBookData() {
    var body = document.querySelector('.story-body, .poem-text, .poem-body');
    if (!body) return null;
    var box = body.closest('.card') || document.querySelector('main.container');
    var h1 = (box && box.querySelector('h1')) || document.querySelector('h1');
    var title = (h1 ? h1.textContent : document.title).replace(/\s*—\s*Bidhan Arya\s*$/, '').trim() || 'Untitled';
    var extracted = extractBody(body);
    return {
      title: title,
      author: 'Bidhan Arya',
      lang: document.documentElement.lang || 'en',
      lines: extracted.lines,
      isPoem: extracted.isPoem,
      box: box
    };
  }

  function slugFromPath() {
    var m = location.pathname.match(/\/([^\/]+)\.html?$/);
    return m ? m[1] : 'download';
  }

  // ---------- PDF ----------
  function buildPrintClone(data) {
    var wrap = document.createElement('div');
    wrap.lang = data.lang;
    // Plain, normal-flow placement (no position:fixed/absolute, no
    // negative-offset "hide it off-canvas" trick). html2canvas is
    // documented to render position:fixed elements unreliably — often as
    // a blank canvas — and this site's body also has overflow-x:hidden,
    // which would clip an off-screen element anyway. Appending as a
    // normal block at the end of <body> sidesteps both: it briefly adds
    // a white block below the page while exporting, then gets removed.
    wrap.style.cssText = [
      'width:700px', 'max-width:calc(100vw - 32px)', 'margin:24px auto',
      'background:#ffffff', 'color:#1a1a1a', 'padding:48px',
      "font-family:Georgia,'Noto Serif Devanagari',serif",
      'font-size:15px', 'line-height:1.7'
    ].join(';');

    var h1 = document.createElement('h1');
    h1.textContent = data.title;
    h1.style.cssText = 'font-size:26px;margin:0 0 4px;color:#111;';
    wrap.appendChild(h1);

    var byline = document.createElement('div');
    byline.textContent = 'by ' + data.author;
    byline.style.cssText = 'font-size:13px;color:#666;margin:0 0 28px;font-style:italic;';
    wrap.appendChild(byline);

    data.lines.forEach(function (text) {
      var el = document.createElement('div');
      el.style.whiteSpace = 'pre-line';
      el.style.pageBreakInside = 'avoid';
      el.style.textAlign = data.isPoem ? 'left' : 'justify';
      el.style.margin = '0 0 ' + (data.isPoem ? '10px' : '14px');
      el.textContent = text || ' ';
      wrap.appendChild(el);
    });

    document.body.appendChild(wrap);
    return wrap;
  }

  function downloadPDF() {
    var data = getBookData();
    if (!data) return;
    if (!window.html2pdf) { alert('PDF export is still loading — give it a second and try again.'); return; }

    var clone = buildPrintClone(data);
    var cleanup = function () { if (clone.parentNode) clone.parentNode.removeChild(clone); };

    window.html2pdf().set({
      filename: slugFromPath() + '.pdf',
      margin: [40, 36, 40, 36],
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, backgroundColor: '#ffffff', useCORS: true },
      jsPDF: { unit: 'pt', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'avoid-all'] }
    }).from(clone).save().then(cleanup).catch(function (err) {
      cleanup();
      console.error('PDF export failed:', err);
      alert('Sorry, the PDF export failed. Please try again.');
    });
  }

  // ---------- ePub ----------
  function escapeXml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function buildChapterXhtml(data) {
    var body = data.lines.map(function (text) {
      var cls = data.isPoem ? 'line' : 'para';
      var content = text ? escapeXml(text).split('\n').join('<br/>') : ' ';
      return '<p class="' + cls + '">' + content + '</p>';
    }).join('\n    ');

    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="' + data.lang + '">\n' +
      '<head>\n  <meta charset="utf-8"/>\n  <title>' + escapeXml(data.title) + '</title>\n' +
      '  <link rel="stylesheet" type="text/css" href="style.css"/>\n' +
      '</head>\n<body>\n' +
      '  <h1>' + escapeXml(data.title) + '</h1>\n' +
      '  <p class="byline">by ' + escapeXml(data.author) + '</p>\n' +
      '  <div class="content">\n    ' + body + '\n  </div>\n' +
      '</body>\n</html>';
  }

  function downloadEPUB() {
    var data = getBookData();
    if (!data) return;
    if (!window.JSZip) { alert('ePub export is still loading — give it a second and try again.'); return; }

    var zip = new window.JSZip();
    zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

    zip.folder('META-INF').file('container.xml',
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">\n' +
      '  <rootfiles>\n' +
      '    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>\n' +
      '  </rootfiles>\n' +
      '</container>');

    var oebps = zip.folder('OEBPS');
    var uid = 'urn:uuid:bidhanarya-' + slugFromPath();
    var modified = new Date().toISOString().replace(/\.\d+Z$/, 'Z');

    oebps.file('content.opf',
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">\n' +
      '  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">\n' +
      '    <dc:identifier id="bookid">' + uid + '</dc:identifier>\n' +
      '    <dc:title>' + escapeXml(data.title) + '</dc:title>\n' +
      '    <dc:creator>' + escapeXml(data.author) + '</dc:creator>\n' +
      '    <dc:language>' + data.lang + '</dc:language>\n' +
      '    <meta property="dcterms:modified">' + modified + '</meta>\n' +
      '  </metadata>\n' +
      '  <manifest>\n' +
      '    <item id="chapter" href="chapter1.xhtml" media-type="application/xhtml+xml"/>\n' +
      '    <item id="css" href="style.css" media-type="text/css"/>\n' +
      '    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>\n' +
      '  </manifest>\n' +
      '  <spine>\n    <itemref idref="chapter"/>\n  </spine>\n' +
      '</package>');

    oebps.file('nav.xhtml',
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">\n' +
      '<head><title>Contents</title></head>\n<body>\n' +
      '  <nav epub:type="toc" id="toc">\n    <ol>\n      <li><a href="chapter1.xhtml">' + escapeXml(data.title) + '</a></li>\n    </ol>\n  </nav>\n' +
      '</body>\n</html>');

    oebps.file('style.css',
      'body{font-family:Georgia,"Noto Serif Devanagari",serif;line-height:1.7;margin:1.5em;color:#1a1a1a;}\n' +
      'h1{font-size:1.6em;margin-bottom:0.1em;}\n' +
      '.byline{font-style:italic;color:#666;margin-bottom:2em;}\n' +
      '.content .para{margin:0 0 1em;text-align:justify;}\n' +
      '.content .line{margin:0 0 0.3em;text-align:left;}');

    oebps.file('chapter1.xhtml', buildChapterXhtml(data));

    zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' }).then(function (blob) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = slugFromPath() + '.epub';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    }).catch(function (err) {
      console.error('ePub export failed:', err);
      alert('Sorry, the ePub export failed. Please try again.');
    });
  }

  // ---------- Wire up the buttons ----------
  var data0 = getBookData();
  if (!data0 || !data0.box) return;
  var box = data0.box;

  var row = box.querySelector('.story-actions, .poem-actions');
  if (!row) {
    row = document.createElement('div');
    row.className = 'story-actions';
    var h1 = box.querySelector('h1');
    if (h1 && h1.nextSibling) h1.parentNode.insertBefore(row, h1.nextSibling);
    else box.insertBefore(row, box.firstChild);
  }

  var pdfBtn = row.querySelector('#download');
  if (!pdfBtn) {
    pdfBtn = document.createElement('button');
    pdfBtn.type = 'button';
    pdfBtn.id = 'download';
    pdfBtn.className = 'btn outline';
    pdfBtn.textContent = 'Download PDF';
    row.insertBefore(pdfBtn, row.firstChild);
  }
  pdfBtn.removeAttribute('href');
  pdfBtn.addEventListener('click', function (e) { e.preventDefault(); downloadPDF(); });

  var epubBtn = row.querySelector('#downloadEpub');
  if (!epubBtn) {
    epubBtn = document.createElement('button');
    epubBtn.type = 'button';
    epubBtn.id = 'downloadEpub';
    epubBtn.className = 'btn outline';
    epubBtn.textContent = 'Download ePub';
    if (pdfBtn.nextSibling) row.insertBefore(epubBtn, pdfBtn.nextSibling);
    else row.appendChild(epubBtn);
  }
  epubBtn.addEventListener('click', function (e) { e.preventDefault(); downloadEPUB(); });
})();
