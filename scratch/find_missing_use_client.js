import fs from 'fs';
import path from 'path';

function findFiles(dir, filter, list = []) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            findFiles(filePath, filter, list);
        } else if (filter.test(file)) {
            list.push(filePath);
        }
    });
    return list;
}

const appDir = 'app';
const files = findFiles(appDir, /\.tsx$/);

files.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes('useState') || content.includes('useEffect') || content.includes('useRouter') || content.includes('useSession')) {
        if (!content.includes('"use client"') && !content.includes("'use client'")) {
            console.log(file);
        }
    }
});
