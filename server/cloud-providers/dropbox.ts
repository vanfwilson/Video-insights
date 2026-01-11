import { Dropbox } from 'dropbox';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=dropbox',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Dropbox not connected');
  }
  return accessToken;
}

export async function getDropboxClient() {
  const accessToken = await getAccessToken();
  return new Dropbox({ accessToken });
}

export async function listDropboxFiles(path: string = '') {
  const dbx = await getDropboxClient();
  const result = await dbx.filesListFolder({ path: path || '' });
  return result.result.entries.map(entry => ({
    id: (entry as any).id || entry.path_lower,
    name: entry.name,
    path: entry.path_display || entry.path_lower,
    type: entry['.tag'] as 'file' | 'folder' | 'deleted',
    size: entry['.tag'] === 'file' ? (entry as any).size : undefined,
    modified: entry['.tag'] === 'file' ? (entry as any).server_modified : undefined,
  }));
}

export async function getDropboxAccountInfo() {
  const dbx = await getDropboxClient();
  const result = await dbx.usersGetCurrentAccount();
  return {
    accountId: result.result.account_id,
    name: result.result.name.display_name,
    email: result.result.email,
    profilePhotoUrl: result.result.profile_photo_url,
  };
}

export async function getDropboxFileTemporaryLink(path: string) {
  const dbx = await getDropboxClient();
  const result = await dbx.filesGetTemporaryLink({ path });
  return result.result.link;
}

export async function downloadDropboxFile(path: string) {
  const dbx = await getDropboxClient();
  const result = await dbx.filesDownload({ path });
  return result.result;
}

export async function isDropboxConnected(): Promise<boolean> {
  try {
    await getAccessToken();
    return true;
  } catch {
    return false;
  }
}

const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.wmv', '.flv', '.3gp'];

export interface DropboxVideoFile {
  id: string;
  name: string;
  path: string;
  size: number;
  modified: string;
}

export async function searchDropboxVideosRecursive(basePath: string = ''): Promise<DropboxVideoFile[]> {
  const dbx = await getDropboxClient();
  const videos: DropboxVideoFile[] = [];
  
  async function listFolderRecursive(path: string) {
    let result = await dbx.filesListFolder({ 
      path: path || '', 
      recursive: true,
      limit: 2000 
    });
    
    processEntries(result.result.entries);
    
    while (result.result.has_more) {
      result = await dbx.filesListFolderContinue({ cursor: result.result.cursor });
      processEntries(result.result.entries);
    }
  }
  
  function processEntries(entries: any[]) {
    for (const entry of entries) {
      if (entry['.tag'] === 'file') {
        const ext = entry.name.toLowerCase().substring(entry.name.lastIndexOf('.'));
        if (VIDEO_EXTENSIONS.includes(ext)) {
          videos.push({
            id: entry.id || entry.path_lower,
            name: entry.name,
            path: entry.path_display || entry.path_lower,
            size: entry.size,
            modified: entry.server_modified,
          });
        }
      }
    }
  }
  
  await listFolderRecursive(basePath);
  return videos;
}

export async function downloadDropboxFileToPath(sourcePath: string, destPath: string): Promise<void> {
  const dbx = await getDropboxClient();
  const fs = await import('fs');
  const result = await dbx.filesDownload({ path: sourcePath });
  const fileData = (result.result as any).fileBinary;
  fs.writeFileSync(destPath, fileData);
}
