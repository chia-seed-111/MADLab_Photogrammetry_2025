// Mary May08 2025
// NOTE: need to look into a proper method of substituting Git PAT - proxy so the token is not exposed?
const GITHUB_TOKEN = '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';
const OWNER = 'chia-seed-111';
const REPO  = 'MADLab_Photogrammetry_2025';

function log(msg) {
  document.getElementById('log').textContent += msg + '\n';
}

async function uploadFile(path, base64content) {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}`;
  const body = {
    message: `Add ${path}`,
    content: base64content,
    branch: 'main'
  };
  const resp = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const err = await resp.json();
    throw new Error(`Upload failed (${path}): ${err.message}`);
  }
}

async function runWorkflow(uploadDir) {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/photogrammetry.yml/dispatches`;
  const body = {
    ref: 'main',
    inputs: { uploadDir }
  };
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!resp.ok) throw new Error(`GitHub API: ${resp.statusText}`);
  return resp;
}

document.getElementById('runBtn').onclick = async () => {
  const input = document.getElementById('zipInput');
  if (!input.files.length) {
    log('🟡STATUS🟡: Please select a ZIP file first.');
    return;
  }

  const zipFile = input.files[0];
  const jobId = 'uploads/job-${Date.now()}';

  try {
    log('🟢STATUS🟢: Loading ZIP (“${zipFile.name}”)…');
    const jszip = await JSZip.loadAsync(zipFile);

    const entries = Object.values(jszip.files)
      .filter(e => !e.dir && /\.(jpe?g|png|tiff?|heic)$/i.test(e.name));

    if (!entries.length) {
      log('🔴STATUS🔴: Please make sure your ZIP contains image files.');
      return;
    }

    for (const entry of entries) {
      log('🟢STATUS🟢: Unzipping ${entry.name}…');
      const base64 = await entry.async('base64');
      const targetPath = '${jobId}/${entry.name}';
      log('🟢STATUS🟢: Uploading to ${targetPath}…');
      await uploadFile(targetPath, base64);
    }

    log('🟢STATUS🟢: All images uploaded.');
    log('🟢STATUS🟢: Dispatching workflow…');
    await runWorkflow(jobId);
    log('🟢STATUS🟢: Photogrammetry progress initiated! Check GitHub Actions “Photogrammetry” run for progress.');
  }
  catch (e) {
    log(`🔴STATUS🔴: Error: ${e.message}`);
  }
};
