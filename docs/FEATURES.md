# freestruct Features

All 181 functions generating 99+ outputs.

## Core SEO (10)
- inject() - Main entry - injects meta tags, OG, canonical, cache bust
- generateSitemap, generateRobots, generateFeed, generate404
- searchIndex, readingTime, lastModified, lazyLoad

## Agent Tools (8)
- extractApis, chunkForRag, linkSourceToDocs
- extractExamples, generateSidebar, injectHeadingIds
- extractTypes, getGitModified

## Feature Tools (40+)
- structuredData, hreflangs, extractFaq
- metaSummary, duplicateTitles, extractImages
- extractAllLinks, missingAlt, viewTransitions
- extractKeywords, depthScore, validateUrls
- readingProgress, codeStats, clipboardConfig
- extractAnchors, searchConfig, emptySections
- lastUpdated, twitterHandles, printConfig
- editLinks, extractDates, copyYear
- docVersion, extractEmails, localeConfig
- extractCssClasses, darkModeConfig, analyticsConfig
- pwaConfig, ogConfig, footerLinks
- socialLinks, navbarConfig, extractVideos
- mermaidConfig, diagramConfig, extractMath
- chartConfig, highlightConfig, extractEndpoints

## UI Configs (40+)
- sidebarConfig, tocConfig, extractScripts
- extractStyles, paginationConfig, searchUx
- docsetConfig, algoliaConfig, pagefindConfig
- mermaidThemes, codegroupConfig, tabsConfig
- adsConfig, commentConfig, feedbackConfig
- donateConfig, announcementConfig, calloutsConfig
- badgeConfig, cardConfig, menuConfig
- modalConfig, tooltipConfig, copyButtonConfig
- versionDropdown, languagePicker, themePicker
- manifestRefs, sitemapIndex, buildManifest

## Content Analysis (20+)
- headingsTree, fullToc, extractLists
- extractQuotes, rawBlocks, externalResources
- robotsMeta, documentMap, extractFavicons
- viewportMeta, langAttrs

## Batch Outputs (80+)
- batchPass1-12 (b1-b12.json)
- bigBatch - 58-feature list
- moarPass1-12 (moar1-moar12.json)
- ultraPass1-10 (u1-u10.json)
- megaPass1-10 (mega1-mega10.json)
- hyperPass1-10 (h1-h10.json)
- omegaPass1-10 (o1-o10.json)
- deltaPass1-10 (d1-d10.json)

## Feature Flags
All toggleable in ssr-config.yml. All ON by default.

## Outputs
99+ JSON/XML files generated per build.
