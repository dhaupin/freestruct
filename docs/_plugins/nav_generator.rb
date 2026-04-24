# Dynamic navigation generator - builds nav from docs folder structure
# Folders become collapsible sections, files become links
require 'fileutils'

module Jekyll
  class NavGenerator < Generator
    safe true

    def generate(site)
      @site = site
      nav_data = build_nav(site.pages, site.config)
      site.config['nav'] = nav_data
    end

    def build_nav(pages, config)
      nav = []
      docs_dir = config['source'] || 'docs'

      # Get all docs folders
      folders = {}
      pages.each do |page|
        next unless page.path
        path = page.path

        # Skip special files
        next if path.start_with?('_') || path.start_with?('lib/')

        # Get folder
        folder = File.dirname(path)
        folder = '.' if folder == '.'

        # Get title from frontmatter or filename
        title = page.data['title'] || File.basename(path, '.md').gsub('-', ' ').capitalize
        title = title.to_s

        # Skip index and hidden pages
        next if page.data['nav'] == false
        next if File.basename(path) == 'index.md'

        if folder == '.'
          nav << { 'title' => title, 'url' => page.url }
        else
          folders[folder] ||= { 'title' => folder.gsub('-', ' ').capitalize, 'items' => [] }
          folders[folder]['items'] << { 'title' => title, 'url' => page.url }
        end
      end

      # Sort folders
      folders.each { |k, v| v['items'].sort_by! { |i| i['title'] } }

      # Merge root items and folders
      nav + folders.values.sort_by { |f| f['title'] }
    end
  end
end
