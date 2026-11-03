// Renders the two PDFs:
//   pdf/product-list.html -> pdf/Pak-Supplies-Product-List.pdf (order sheet, page numbers in footer)
//   pdf/catalogue.html    -> pdf/Pak-Supplies-Catalogue.pdf    (customer catalogue, footers built into each page)
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto('file://' + path.join(__dirname, 'product-list.html'), { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({
    path: path.join(__dirname, 'Pak-Supplies-Product-List.pdf'),
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: '<div style="width:100%;font:7.5pt sans-serif;color:#5D6A62;padding:0 13mm;display:flex;justify-content:space-between"><span>Pak Supplies · Product List</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>',
  });

  await page.goto('file://' + path.join(__dirname, 'catalogue.html'), { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({
    path: path.join(__dirname, 'Pak-Supplies-Catalogue.pdf'),
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
  });

  await browser.close();
})();
