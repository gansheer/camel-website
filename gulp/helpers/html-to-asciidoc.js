const { parse } = require('node-html-parser');

/**
 * Converts HTML content to AsciiDoc format.
 * This is a custom converter that handles common HTML elements from Antora-generated documentation.
 */
class HtmlToAsciiDocConverter {
  constructor() {
    this.listDepth = 0;
  }

  /**
   * Convert HTML string to AsciiDoc
   * @param {string} html - HTML content to convert
   * @returns {string} AsciiDoc formatted text
   */
  convert(html) {
    const root = parse(html);
    return this.processNode(root);
  }

  processNode(node) {
    if (!node) return '';

    // Text nodes
    if (node.nodeType === 3) { // TEXT_NODE
      return node.text;
    }

    // Element nodes
    if (node.nodeType === 1) { // ELEMENT_NODE
      const tagName = node.tagName ? node.tagName.toLowerCase() : '';

      switch (tagName) {
        case 'h1':
          return `= ${this.getTextContent(node)}\n\n`;
        case 'h2':
          return `== ${this.getTextContent(node)}\n\n`;
        case 'h3':
          return `=== ${this.getTextContent(node)}\n\n`;
        case 'h4':
          return `==== ${this.getTextContent(node)}\n\n`;
        case 'h5':
          return `===== ${this.getTextContent(node)}\n\n`;
        case 'h6':
          return `====== ${this.getTextContent(node)}\n\n`;

        case 'p':
          const pContent = this.processChildren(node);
          return pContent ? `${pContent}\n\n` : '';

        case 'strong':
        case 'b':
          return `*${this.getTextContent(node)}*`;

        case 'em':
        case 'i':
          return `_${this.getTextContent(node)}_`;

        case 'code':
          // Inline code
          return `\`${this.getTextContent(node)}\``;

        case 'pre':
          // Code block
          const codeNode = node.querySelector('code');
          if (codeNode) {
            const language = this.extractLanguage(codeNode);
            const code = this.getTextContent(codeNode);
            return `[source,${language}]\n----\n${code}\n----\n\n`;
          }
          return `----\n${this.getTextContent(node)}\n----\n\n`;

        case 'a':
          const href = node.getAttribute('href') || '';
          const linkText = this.getTextContent(node);
          if (href === linkText || !linkText) {
            return href;
          }
          return `${href}[${linkText}]`;

        case 'ul':
          return this.processList(node, '*');

        case 'ol':
          return this.processList(node, '.');

        case 'li':
          // Handled by processList
          return this.processChildren(node);

        case 'table':
          return this.processTable(node);

        case 'blockquote':
          return this.processBlockquote(node);

        case 'div':
          // Handle special Asciidoctor div classes
          if (node.classList) {
            if (node.classList.contains('admonitionblock')) {
              return this.processAdmonition(node);
            }
            if (node.classList.contains('listingblock') || node.classList.contains('literalblock')) {
              const content = this.getTextContent(node.querySelector('.content') || node);
              return `----\n${content}\n----\n\n`;
            }
          }
          return this.processChildren(node);

        case 'br':
          return ' +\n';

        case 'hr':
          return "'''\n\n";

        case 'img':
          const src = node.getAttribute('src') || '';
          const alt = node.getAttribute('alt') || '';
          return `image::${src}[${alt}]\n\n`;

        default:
          return this.processChildren(node);
      }
    }

    // Process all child nodes
    return this.processChildren(node);
  }

  processChildren(node) {
    if (!node.childNodes) return '';
    return node.childNodes.map(child => this.processNode(child)).join('');
  }

  getTextContent(node) {
    if (!node) return '';
    if (node.nodeType === 3) return node.text;
    if (!node.childNodes) return '';

    return node.childNodes.map(child => {
      if (child.nodeType === 3) return child.text;
      return this.getTextContent(child);
    }).join('');
  }

  extractLanguage(codeNode) {
    const classList = codeNode.getAttribute('class') || '';
    const match = classList.match(/language-(\w+)/);
    if (match) return match[1];

    // Check for Asciidoctor data-lang attribute
    const dataLang = codeNode.getAttribute('data-lang');
    if (dataLang) return dataLang;

    return 'text';
  }

  processList(node, marker) {
    this.listDepth++;
    const items = node.querySelectorAll(':scope > li');
    const prefix = marker.repeat(this.listDepth);

    let result = '';
    items.forEach(item => {
      const content = this.processNode(item).trim();
      result += `${prefix} ${content}\n`;
    });

    this.listDepth--;
    return result + '\n';
  }

  processTable(node) {
    const rows = node.querySelectorAll('tr');
    if (rows.length === 0) return '';

    let result = '[cols="*"]\n|===\n';

    rows.forEach((row, rowIndex) => {
      const cells = row.querySelectorAll('th, td');
      cells.forEach(cell => {
        const content = this.getTextContent(cell).trim();
        const prefix = cell.tagName.toLowerCase() === 'th' ? '|*' : '|';
        result += `${prefix}${content}\n`;
      });
    });

    result += '|===\n\n';
    return result;
  }

  processBlockquote(node) {
    const content = this.processChildren(node);
    const lines = content.split('\n').filter(line => line.trim());
    return '[quote]\n____\n' + lines.join('\n') + '\n____\n\n';
  }

  processAdmonition(node) {
    // Extract the icon type (TIP, NOTE, IMPORTANT, WARNING, CAUTION)
    const iconElement = node.querySelector('.icon i');
    let admonitionType = 'NOTE';

    if (iconElement) {
      const title = iconElement.getAttribute('title') || '';
      admonitionType = title.toUpperCase() || 'NOTE';
    }

    // Extract the content
    const contentDiv = node.querySelector('.content');
    if (!contentDiv) return '';

    const content = this.processNode(contentDiv).trim();

    return `[${admonitionType}]\n====\n${content}\n====\n\n`;
  }
}

/**
 * Creates a new HTML to AsciiDoc converter instance
 * @returns {HtmlToAsciiDocConverter}
 */
function createHtmlToAsciiDocConverter() {
  return new HtmlToAsciiDocConverter();
}

module.exports = { createHtmlToAsciiDocConverter };
