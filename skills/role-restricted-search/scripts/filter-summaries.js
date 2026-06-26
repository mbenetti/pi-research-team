#!/usr/bin/env node
// Filter results to summaries only (for manager role)
import { readFileSync } from 'fs';

const args = process.argv.slice(2);
let maxResults = 10;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--max') maxResults = parseInt(args[i + 1]) || 10;
}

const input = readFileSync(0, 'utf-8');

try {
  const data = JSON.parse(input);
  const results = data.web?.results?.slice(0, maxResults) || [];
  
  console.log('=== Search Results (Summarized) ===\n');
  
  results.forEach((r, i) => {
    const title = r.title?.substring(0, 80) || 'Untitled';
    const snippet = r.description?.substring(0, 120) || 'No description';
    
    console.log(`${i + 1}. ${title}...`);
    console.log(`   ${snippet}...`);
    console.log(`   Source: ${new URL(r.url).hostname}`);
    console.log();
  });
  
  console.log(`(${results.length} results - limited view for manager role)`);
} catch (e) {
  console.error('Error parsing results');
  console.log('Search results unavailable');
}