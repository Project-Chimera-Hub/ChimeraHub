import https from 'https';
import fs from 'fs';
import path from 'path';

const LANDSCAPE_URLS = [
  'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=350&q=70', // Mountain
  'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=350&q=70', // Forest
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=350&q=70', // Coast
  'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=350&q=70', // Desert
  'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=350&q=70', // Yosemite Valley
  'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?w=350&q=70', // Starry Sky
];

const destDir = path.resolve('public/assets/landscapes');

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

console.log('Downloading landscapes...');

function download(url, dest, callback) {
  const file = fs.createWriteStream(dest);
  https.get(url, (response) => {
    if (response.statusCode === 302 || response.statusCode === 301) {
      // Handle redirect
      download(response.headers.location, dest, callback);
      return;
    }
    response.pipe(file);
    file.on('finish', () => {
      file.close(callback);
    });
  }).on('error', (err) => {
    fs.unlink(dest, () => {});
    console.error('Error downloading:', url, err.message);
    callback(err);
  });
}

let completed = 0;
LANDSCAPE_URLS.forEach((url, index) => {
  const destPath = path.join(destDir, `landscape${index + 1}.jpg`);
  download(url, destPath, (err) => {
    if (!err) {
      console.log(`Saved landscape${index + 1}.jpg`);
    }
    completed++;
    if (completed === LANDSCAPE_URLS.length) {
      console.log('All downloads completed successfully!');
    }
  });
});
