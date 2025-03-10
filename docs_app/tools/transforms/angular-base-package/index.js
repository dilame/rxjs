/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
const path = require('path');
const Package = require('dgeni').Package;

const jsdocPackage = require('dgeni-packages/jsdoc');
const nunjucksPackage = require('dgeni-packages/nunjucks');
const linksPackage = require('../links-package');
const remarkPackage = require('../remark-package');
const postProcessPackage = require('dgeni-packages/post-process-html');

const { PROJECT_ROOT, CONTENTS_PATH, OUTPUT_PATH, DOCS_OUTPUT_PATH, TEMPLATES_PATH, AIO_PATH, requireFolder } = require('../config');

// prettier-ignore
module.exports = new Package('angular-base', [
  jsdocPackage,
  nunjucksPackage,
  linksPackage,
  remarkPackage,
  postProcessPackage,
])

  // Register the processors
  .processor(require('./processors/generateKeywords'))
  .processor(require('./processors/createSitemap'))
  .processor(require('./processors/checkUnbalancedBackTicks'))
  .processor(require('./processors/convertToJson'))
  .processor(require('./processors/fixInternalDocumentLinks'))
  .processor(require('./processors/copyContentAssets'))
  .processor(require('./processors/renderLinkInfo'))
  .processor(require('./processors/checkOperator'))

  // overrides base packageInfo and returns the one for the 'angular/angular' repo.
  .factory('packageInfo', function () {
    return require(path.resolve(PROJECT_ROOT, 'package.json'));
  })
  .factory(require('./readers/json'))
  .factory(require('./services/copyFolder'))
  .factory(require('./services/filterPipes'))
  .factory(require('./services/filterAmbiguousDirectiveAliases'))
  .factory(require('./services/filterFromInImports'))
  .factory(require('./services/filterNeverAsGeneric'))
  .factory(require('./services/getImageDimensions'))

  .factory(require('./post-processors/add-image-dimensions'))
  .factory(require('./post-processors/auto-link-code'))

  .config(function (checkAnchorLinksProcessor) {
    // This is disabled here to prevent false negatives for the `docs-watch` task.
    // It is re-enabled in the main `angular.io-package`
    checkAnchorLinksProcessor.$enabled = false;
  })

  // Where do we get the source files?
  .config(function (readFilesProcessor, generateKeywordsProcessor, jsonFileReader) {
    readFilesProcessor.fileReaders.push(jsonFileReader);
    readFilesProcessor.basePath = PROJECT_ROOT;
    readFilesProcessor.sourceFiles = [];

    generateKeywordsProcessor.ignoreWords = require(path.resolve(__dirname, 'ignore-words'));
    generateKeywordsProcessor.docTypesToIgnore = [
      undefined,
      'json-doc',
      'api-list-data',
      'api-list-data',
      'contributors-json',
      'navigation-json',
      'announcements-json',
    ];
    generateKeywordsProcessor.propertiesToIgnore = ['basePath', 'renderedContent', 'docType', 'searchTitle'];
  })

  // Where do we write the output files?
  .config(function (writeFilesProcessor) {
    writeFilesProcessor.outputFolder = DOCS_OUTPUT_PATH;
  })

  // Configure nunjucks rendering of docs via templates
  .config(function (renderDocsProcessor, templateFinder, templateEngine, getInjectables) {
    // Where to find the templates for the doc rendering
    templateFinder.templateFolders = [TEMPLATES_PATH];

    // Standard patterns for matching docs to templates
    templateFinder.templatePatterns = [
      '${ doc.template }',
      '${ doc.id }.${ doc.docType }.template.html',
      '${ doc.id }.template.html',
      '${ doc.docType }.template.html',
      '${ doc.id }.${ doc.docType }.template.js',
      '${ doc.id }.template.js',
      '${ doc.docType }.template.js',
      '${ doc.id }.${ doc.docType }.template.json',
      '${ doc.id }.template.json',
      '${ doc.docType }.template.json',
      'common.template.html',
    ];

    // Nunjucks and Angular conflict in their template bindings so change Nunjucks
    templateEngine.config.tags = { variableStart: '{$', variableEnd: '$}' };

    templateEngine.filters = templateEngine.filters.concat(getInjectables(requireFolder(__dirname, './rendering')));

    // helpers are made available to the nunjucks templates
    renderDocsProcessor.helpers.relativePath = function (from, to) {
      return path.relative(from, to);
    };
  })

  .config(function (copyContentAssetsProcessor) {
    copyContentAssetsProcessor.assetMappings.push({ from: path.resolve(CONTENTS_PATH, 'images'), to: path.resolve(OUTPUT_PATH, 'images') });
  })

  // We are not going to be relaxed about ambiguous links
  .config(function (getLinkInfo) {
    getLinkInfo.useFirstAmbiguousLink = false;
  })

  .config(function (generateKeywordsProcessor) {
    generateKeywordsProcessor.outputFolder = 'app';
  })

  .config(function (
    postProcessHtml,
    addImageDimensions,
    autoLinkCode,
    filterPipes,
    filterAmbiguousDirectiveAliases,
    filterFromInImports,
    filterNeverAsGeneric
  ) {
    addImageDimensions.basePath = path.resolve(AIO_PATH, 'src');
    autoLinkCode.customFilters = [filterPipes, filterAmbiguousDirectiveAliases];
    autoLinkCode.wordFilters = [filterFromInImports, filterNeverAsGeneric];
    postProcessHtml.plugins = [
      require('./post-processors/autolink-headings'),
      addImageDimensions,
      require('./post-processors/h1-checker'),
      autoLinkCode,
    ];
  })

  .config(function (convertToJsonProcessor) {
    convertToJsonProcessor.docTypes = [];
  });
