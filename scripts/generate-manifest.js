#!/usr/bin/env node

/**
 * Generate skills-manifest.json
 * 
 * This script automatically scans the skills/ directory and generates
 * the skills-manifest.json file. It's run by:
 * 1. npm run generate-manifest (manual)
 * 2. npm run prepare (after npm install, runs automatically)
 * 3. Git pre-commit hook (automatic on git commit)
 */

const fs = require('fs');
const path = require('path');

const SKILLS_DIR = path.join(__dirname, '../skills');
const MANIFEST_FILE = path.join(SKILLS_DIR, 'skills-manifest.json');

/**
 * Extract description from .md file
 * Looks for lines like:
 * - description: ... (in YAML-style frontmatter)
 * - # skillname (first heading)
 */
function extractDescription(mdFile) {
    try {
        const content = fs.readFileSync(mdFile, 'utf-8');
        
        // Try to find "description:" line
        const descMatch = content.match(/^description:\s*(.+?)$/m);
        if (descMatch && descMatch[1]) {
            return descMatch[1].trim();
        }
        
        // Fallback: get first line after name
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('name:')) {
                // Find next non-empty line
                for (let j = i + 1; j < lines.length; j++) {
                    const line = lines[j].trim();
                    if (line && !line.startsWith('-') && !line.startsWith('when_to_use')) {
                        return line.substring(0, 100); // Limit to 100 chars
                    }
                }
            }
        }
        
        return 'Skill'; // Default
    } catch (error) {
        console.error(`Error reading ${mdFile}:`, error.message);
        return 'Skill';
    }
}

/**
 * Main function: scan skills directory and generate manifest
 */
function generateManifest() {
    const skills = [];
    
    // Check if skills directory exists
    if (!fs.existsSync(SKILLS_DIR)) {
        console.error(`❌ Skills directory not found: ${SKILLS_DIR}`);
        process.exit(1);
    }
    
    // Scan all subdirectories in skills/
    const entries = fs.readdirSync(SKILLS_DIR, { withFileTypes: true });
    
    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        
        const skillName = entry.name;
        const skillPath = path.join(SKILLS_DIR, skillName);
        const mdFile = path.join(skillPath, `${skillName}.md`);
        const jsFile = path.join(skillPath, `${skillName}.js`);
        
        // Check if both .md and .js files exist
        if (!fs.existsSync(mdFile)) {
            console.warn(`⚠️  Missing ${skillName}.md in skills/${skillName}/`);
            continue;
        }
        if (!fs.existsSync(jsFile)) {
            console.warn(`⚠️  Missing ${skillName}.js in skills/${skillName}/`);
            continue;
        }
        
        // Extract description from .md file
        const description = extractDescription(mdFile);
        
        // Add to skills list
        skills.push({
            name: skillName,
            folder: skillName,
            description: description,
            runInPageContext: false
        });
        
        console.log(`✅ Found skill: ${skillName}`);
    }
    
    // Sort skills alphabetically by name
    skills.sort((a, b) => a.name.localeCompare(b.name));
    
    // Create manifest object
    const manifest = {
        skills: skills
    };
    
    // Write manifest file
    try {
        fs.writeFileSync(
            MANIFEST_FILE,
            JSON.stringify(manifest, null, 2) + '\n'
        );
        console.log(`\n✅ Generated manifest with ${skills.length} skills`);
        console.log(`📄 File: ${MANIFEST_FILE}`);
        
        // List all skills
        if (skills.length > 0) {
            console.log('\n📚 Registered skills:');
            skills.forEach((skill, i) => {
                console.log(`   ${i + 1}. ${skill.name}: ${skill.description}`);
            });
        }
    } catch (error) {
        console.error(`\n❌ Failed to write manifest file:`, error.message);
        process.exit(1);
    }
}

// Run the script
generateManifest();
