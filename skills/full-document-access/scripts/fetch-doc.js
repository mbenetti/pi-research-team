#!/usr/bin/env node
// Full document fetcher for scientist role
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';

const args = process.argv.slice(2);
let targetUrl = '';
let section = 'all';
let format = 'full';
let cacheDir = '.pi/skills/full-document-access/cache';

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--section':
      section = args[i + 1] || 'all';
      i++;
      break;
    case '--format':
      format = args[i + 1] || 'full';
      i++;
      break;
    case '--cache-dir':
      cacheDir = args[i + 1] || cacheDir;
      i++;
      break;
    default:
      if (!targetUrl && args[i].startsWith('http')) {
        targetUrl = args[i];
      }
  }
}

if (!targetUrl) {
  console.error('Usage: fetch-doc.js <url> [--section all|methodology|results] [--format full|structured|abstract]');
  process.exit(1);
}

// Check cache
const urlHash = Buffer.from(targetUrl).toString('base64').replace(/[/+=]/g, '_');
const cacheFile = `${cacheDir}/${urlHash}.json`;

if (existsSync(cacheFile)) {
  console.log(`[Cache hit for: ${targetUrl}]`);
  const cached = JSON.parse(readFileSync(cacheFile, 'utf-8'));
  outputDocument(cached);
  process.exit(0);
}

// Fetch the document
async function fetchDocument() {
  try {
    // Use curl to fetch the content
    const response = execSync(
      `curl -sL -A "Mozilla/5.0" "${targetUrl}" 2>/dev/null | head -c 500000`,
      { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
    );
    
    // Extract title and content
    const titleMatch = response.match(/<title[^>]*>([^<]+)<\/title>/i) || 
                       response.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    const title = titleMatch ? titleMatch[1].trim() : new URL(targetUrl).pathname;
    
    // Clean HTML tags for text content
    const textContent = response
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 100000); // Limit to 100KB
    
    const document = {
      title,
      url: targetUrl,
      content: textContent,
      fetchedAt: new Date().toISOString(),
      wordCount: textContent.split(/\s+/).length
    };
    
    // Cache it
    if (!existsSync(cacheDir)) {
      mkdirSync(cacheDir, { recursive: true });
    }
    writeFileSync(cacheFile, JSON.stringify(document, null, 2));
    
    outputDocument(document);
  } catch (e) {
    console.error('Error fetching document:', e.message);
    console.log('Content unavailable');
  }
}

function outputDocument(doc) {
  switch (format) {
    case 'abstract':
      // Return first 500 words as abstract
      const abstract = doc.content.split(/\s+/).slice(0, 500).join(' ');
      console.log('=== Abstract ===\n');
      console.log(abstract);
      console.log(`\n\n[Source: ${doc.url}] [Words: ${doc.wordCount}]`);
      break;
      
    case 'structured':
      // Return structured summary
      const words = doc.content.split(/\s+/);
      const first500 = words.slice(0, 500).join(' ');
      const next1000 = words.slice(500, 1500).join(' ');
      
      console.log('=== Structured Document Analysis ===\n');
      console.log(`Title: ${doc.title}`);
      console.log(`Source: ${doc.url}`);
      console.log(`Total Words: ${doc.wordCount}\n`);
      console.log('--- Abstract/Summary ---');
      console.log(first500);
      console.log('\n--- Key Content ---');
      console.log(next1000);
      console.log('\n[Use --format full for complete content]');
      break;
      
    case 'full':
    default:
      console.log('=== Full Document Content ===\n');
      console.log(`Title: ${doc.title}`);
      console.log(`Source: ${doc.url}`);
      console.log(`Words: ${doc.wordCount}`);
      console.log('\n' + '─'.repeat(50) + '\n');
      
      if (section === 'all') {
        console.log(doc.content);
      } else {
        // Extract section (simple heuristic)
        const lines = doc.content.split(/\n/);
        const sectionKeywords = {
          methodology: ['method', 'approach', 'procedure', 'design'],
          results: ['result', 'finding', 'outcome', 'data'],
          discussion: ['discuss', 'implication', 'limitation', 'conclusion']
        };
        
        const keywords = sectionKeywords[section] || ['method', 'result', 'discuss'];
        const sectionLines = lines.filter(line => 
          keywords.some(kw => line.toLowerCase().includes(kw))
        ).slice(0, 200);
        
        console.log(sectionLines.join('\n') || doc.content.split(/\s+/).slice(0, 2000).join(' '));
      }
      break;
  }
}

fetchDocument();