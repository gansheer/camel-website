const fs = require('fs');
const path = require('path');
const { parse } = require('node-html-parser');
const { createHtmlToAsciiDocConverter } = require('../helpers/html-to-asciidoc');

/**
 * Generates complete AsciiDoc (.adoc) files from Antora-generated HTML files.
 *
 * The original AsciiDoc source files are incomplete (they contain includes, xrefs, variables).
 * After Antora processes them, the HTML contains the complete, resolved content.
 * This task converts that processed HTML back to AsciiDoc format to create
 * complete, standalone AsciiDoc files.
 *
 * For each .html file in the documentation/ directory, it creates a corresponding
 * .adoc file with:
 * - Fully resolved content (includes merged, xrefs converted, variables substituted)
 * - Clean AsciiDoc formatting
 * - Proper conversion of HTML elements to AsciiDoc syntax
 */
async function generateAsciiDoc(done) {
  const converter = createHtmlToAsciiDocConverter();

  const glob = require('glob');

  // Get all HTML files from the documentation directory
  const htmlFiles = glob.sync('documentation/**/*.html', {
    ignore: ['documentation/404.html', 'documentation/**/_/**'] // Skip error pages and UI resources
  });

  let processedCount = 0;
  const totalFiles = htmlFiles.length;
  const BATCH_SIZE = 500; // Process in batches to avoid memory issues

  console.log(`Found ${totalFiles} HTML files to convert to AsciiDoc`);

  // Process files in batches
  for (let i = 0; i < htmlFiles.length; i += BATCH_SIZE) {
    const batch = htmlFiles.slice(i, i + BATCH_SIZE);

    for (const htmlFile of batch) {
      try {
        const htmlContent = fs.readFileSync(htmlFile, 'utf8');
        const root = parse(htmlContent);

        // Extract only the main article content
        // Try different selectors based on Antora structure
        let mainContent = root.querySelector('article.doc') ||
                         root.querySelector('main') ||
                         root.querySelector('.article') ||
                         root.querySelector('article');

        if (!mainContent) {
          // Silently skip files without main content
          continue;
        }

        // Remove navigation elements, headers, and footers from the content
        const elementsToRemove = mainContent.querySelectorAll('nav, header, footer, .nav, .navbar, .toolbar');
        elementsToRemove.forEach(el => el.remove());

        // Remove anchor links (they are just UI navigation aids)
        const anchors = mainContent.querySelectorAll('a.anchor');
        anchors.forEach(el => el.remove());

        // Extract the page title from h1 or title attribute
        let pageTitle = '';
        const h1Element = mainContent.querySelector('h1');
        if (h1Element) {
          pageTitle = h1Element.textContent.trim();
        }

        // Convert to AsciiDoc
        let asciidoc = converter.convert(mainContent.innerHTML);

        // Add document header if we have a title
        if (pageTitle) {
          // Remove the first line if it's already the title (from h1 conversion)
          const lines = asciidoc.split('\n');
          if (lines[0].startsWith('= ')) {
            asciidoc = lines.slice(1).join('\n');
          }
          asciidoc = `= ${pageTitle}\n${asciidoc}`;
        }

        // Clean up excessive blank lines (more than 2 consecutive)
        asciidoc = asciidoc.replace(/\n{3,}/g, '\n\n');

        // Update links to point to .adoc files instead of .html
        // Replace relative links *.html with *.adoc
        asciidoc = asciidoc.replace(/\.html\[/g, '.adoc[');
        asciidoc = asciidoc.replace(/\.html#/g, '.adoc#');

        // Write .adoc file in the same location as the HTML file
        const adocFile = htmlFile.replace(/\.html$/, '.adoc');

        // Ensure directory exists
        const adocDir = path.dirname(adocFile);
        if (!fs.existsSync(adocDir)) {
          fs.mkdirSync(adocDir, { recursive: true });
        }

        fs.writeFileSync(adocFile, asciidoc, 'utf8');

        processedCount++;

        // Progress indicator every 100 files
        if (processedCount % 100 === 0) {
          console.log(`  Processed ${processedCount}/${totalFiles} files...`);
        }
      } catch (error) {
        console.error(`Error processing ${htmlFile}:`, error.message);
      }
    }
  }

  console.log(`\nSuccessfully generated ${processedCount} AsciiDoc files`);

  done();
}

module.exports = generateAsciiDoc;
