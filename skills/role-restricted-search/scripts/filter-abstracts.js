#!/usr/bin/env node
// Filter results to abstracts + key points (for researcher role)
import { readFileSync } from 'fs';

const args = process.argv.slice(2);
let maxResults = 20;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--max') maxResults = parseInt(args[i + 1]) || 20;
}

const input = readFileSync(0, 'utf-8');

try {
  const data = JSON.parse(input);
  const results = data.web?.results?.slice(0, maxResults) || [];
  
  console.log('=== Search Results (Abstracts) ===\n');
  
  results.forEach((r, i) => {
    const title = r.title || 'Untitled';
    const abstract = r.description || 'No description available';
    const domain = r.url ? new URL(r.url).hostname : 'Unknown';
    
    // Extract key points from snippet
    const snippets = r.extra_snippets || [abstract];
    
    console.log(`${i + 1}. ${title}`);
    console.log(`   Source: ${domain}`);
    console.log(`   Abstract: ${abstract}`);
    console.log(`   Key Points: • ${abstract.substring(0, 100)}...`);
    console.log();
  });
  
  console.log(`(${results.length} results)`);
} catch (e) {
  console.error('Error parsing results');
  console.log('Search results unavailable');
}