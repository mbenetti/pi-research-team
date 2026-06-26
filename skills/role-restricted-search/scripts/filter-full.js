#!/usr/bin/env node
// Filter results to full snippets (for scientist role)
import { readFileSync } from 'fs';

const args = process.argv.slice(2);
let maxResults = 30;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--max') maxResults = parseInt(args[i + 1]) || 30;
}

const input = readFileSync(0, 'utf-8');

try {
  const data = JSON.parse(input);
  const results = data.web?.results?.slice(0, maxResults) || [];
  
  console.log('=== Search Results (Full) ===\n');
  
  results.forEach((r, i) => {
    const title = r.title || 'Untitled';
    const domain = r.url ? new URL(r.url).hostname : 'Unknown';
    const fullSnippet = r.description || '';
    const url = r.url || '';
    
    // Calculate relevance score based on position
    const relevance = Math.max(10 - i, 5);
    
    // Extract all snippets
    const allSnippets = [fullSnippet, ...(r.extra_snippets || [])].filter(Boolean);
    
    console.log(`${i + 1}. ${title}`);
    console.log(`   Source: ${domain} | Relevance: ${relevance}/10`);
    console.log(`   Full Snippet: ${allSnippets.join(' ')}`);
    console.log(`   URL: ${url}`);
    console.log();
  });
  
  console.log(`(${results.length} results - full access)`);
} catch (e) {
  console.error('Error parsing results');
  console.log('Search results unavailable');
}