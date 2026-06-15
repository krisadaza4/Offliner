var util = require('util'),
    spawn = require('child_process').spawn;
    var archiver = require('../archiver')
    var fs = require('fs');
    var path = require('path');

module.exports=(io,data,socket)=>{

// download all website assets 
/**
 * wget --mirror --convert-links --adjust-extension --page-requisites 
 * --no-parent http://example.org
 * --mirror – Makes (among other things) the download recursive.
 * --convert-links – convert all the links (also to stuff like CSS stylesheets) to relative, so it will be suitable for offline viewing.
 * --adjust-extension – Adds suitable extensions to filenames (html or css) depending on their content-type.
 * --page-requisites – Download things like CSS style-sheets and images required to properly display the page offline.
 * --no-parent – When recurring do not ascend to the parent directory. It useful for restricting the download to only a portion of the site.
 */
let website ="";
let isArchiving = false;
const child = spawn('wget', ['-mkEpnp', '-c', '--no-if-modified-since', data.website]);

// read stdout from the current child.
child.stderr.on("data",(response)=>{
    const responseText = response.toString();

    if(!website)
    {
        const resolvingMatch = responseText.match(/Resolving\s+([^\s]+)\s+\(/);
        if (resolvingMatch && resolvingMatch[1]) {
            website = resolvingMatch[1];
        }
    }
    io.emit(data.token,{progress:responseText})
})

// Handle process termination and cleanup
child.on('exit', (code, signal) => {
    // If signal is present, it means the process was forcefully killed (e.g. user clicked download again)
    if (signal) {
        console.log('Process terminated with signal', signal);
        console.log('Keeping partially downloaded files to allow resuming in future requests.');
    } else {
        const websiteFolder = website || getWebsiteFolderName(data.website);

        if (!websiteFolder) {
            io.emit(data.token, { progress: "Unable to determine downloaded website folder." });
            return;
        }

        if (code !== 0) {
            console.log(`Wget finished with code ${code} (some assets might be missing). Archiving anyway...`);
            io.emit(data.token,{progress:"Converting (Some assets had errors/404s)"});
        } else {
            io.emit(data.token,{progress:"Converting"});
        }
        
        isArchiving = true;
        if (socket) {
            socket.archiverProcess = archiver(websiteFolder,io,data)
        } else {
            archiver(websiteFolder,io,data)
        }
    }
});

function removePartiallyDownloadedFiles(websiteFolder, retries = 3) {
    if (!websiteFolder || isArchiving) {
        if (!isArchiving) console.log('No website folder to remove.');
        return;
    }
    const directory = path.join(__dirname, '../', websiteFolder);
    // Safety check to ensure we don't accidentally delete the root folder or go up the tree
    if (directory === path.resolve(__dirname, '../') || !directory.startsWith(path.resolve(__dirname, '../'))) {
        console.error('Safety check failed: Refusing to delete path', directory);
        return;
    }
    
    // Add a small delay to let any locks release, especially on Windows
    setTimeout(() => {
        fs.rm(directory, { recursive: true, force: true }, (err) => {
            if (err) {
                console.error(`Error while removing partially downloaded files: ${err.message}`);
                if (err.code === 'ENOTEMPTY' || err.code === 'EPERM' || err.code === 'EBUSY') {
                    if (retries > 0) {
                        console.log(`Retrying delete in 1 second... (${retries} retries left)`);
                        removePartiallyDownloadedFiles(websiteFolder, retries - 1);
                    }
                }
            } else {
                console.log('Partially downloaded files removed successfully');
            }
        });
    }, 1000);
}

function getWebsiteFolderName(websiteUrl) {
    try {
        const normalizedUrl = /^https?:\/\//i.test(websiteUrl) ? websiteUrl : `http://${websiteUrl}`;
        const parsedUrl = new URL(normalizedUrl);
        return parsedUrl.port ? `${parsedUrl.hostname}:${parsedUrl.port}` : parsedUrl.hostname;
    } catch (error) {
        return "";
    }
}

return child;
}
