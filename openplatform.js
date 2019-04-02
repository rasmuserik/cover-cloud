import axios from 'axios';
import PouchDB from 'pouchdb';
let bibDB = new PouchDB(
  `https://bib:${process.env.COUCH_BIB}@couch.veduz.com/bib`
);

let openPlatformToken;
const clientId = '74b14121-aa23-4e53-b5ef-522850a13f5e';
const clientSecret =
  '4122efb022161deef3d812a92d309043ddd5c39fcbedaf92fb0240f326889077';

let loadingOpenPlatform;
function loadScript(url) {
  return new Promise((resolve, reject) => {
    const elem = document.createElement('script');
    elem.src = url;
    elem.onload = resolve;
    elem.onerror = reject;
    document.head.appendChild(elem);
  });
}
function ensureDbcOpenPlatform() {
  if (!window.dbcOpenPlatform) {
    if (!loadingOpenPlatform) {
      loadingOpenPlatform = (async () => {
        const token = getOpenPlatformToken();
        await loadScript(
          'https://openplatform.dbc.dk/v3/dbc_openplatform.min.js'
        );
        await window.dbcOpenPlatform.connect(await token);
      })();
    }
    return loadingOpenPlatform;
  }
  return Promise.resolve();
}

const today = () => new Date().toISOString().slice(0, 10);
let coverDate = today();
let coverCache = {};
export function getSpecificCover(pid) {
  if (coverDate !== today()) {
    coverCache = {};
    coverDate = today();
  }
  if (!coverCache[pid]) {
    coverCache[pid] = getSpecificCoverUncached(pid);
  }
  return coverCache[pid];
}

async function getSpecificCoverUncached(pid) {
  const [result] = await openplatform.work({
    pids: [pid],
    fields: ['coverUrlFull']
  });
  if (result && result.coverUrlFull && result.coverUrlFull[0]) {
    return result.coverUrlFull[0];
  }
  return '';
}

export async function getCover(pid) {
  let cover = await getSpecificCover(pid);

  /* TODO re-enable when better performance
  if (!cover) {
    const collection = (await openplatform.work({
      pids: [pid],
      fields: ['collectionDetails']
    }))[0].collectionDetails.map(o => o.pid[0]);
    for (const pid of collection) {
      cover = await getSpecificCover(pid);
      if (cover) {
        break;
      }
    }
  }
  */
  return cover;
}

function getOpenPlatformToken() {
  if (!openPlatformToken) {
    openPlatformToken = (async () =>
      (await axios.post(
        'https://auth.dbc.dk/oauth/token',
        'grant_type=password' + '&username=@' + '&password=@',
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          auth: {
            username: clientId,
            password: clientSecret
          }
        }
      )).data.access_token)();
    setTimeout(
      () => (openPlatformToken = undefined),
      24 * 60 * 60 * 1000
    );
  }
  return openPlatformToken;
}

const endpoints = [
  'availability',
  'order',
  'facets',
  'search',
  'work',
  'libraries',
  'recommend',
  'renew',
  'user',
  'status',
  'storage'
];
async function op(endpoint, args) {
  if (typeof window === 'undefined') {
    const result = (await axios.post(
      `https://openplatform.dbc.dk/v3/${endpoint}?access_token=${await getOpenPlatformToken()}`,
      args || {}
    )).data;
    if (result.statusCode === 200) {
      return result.data;
    } else {
      return result;
    }
  } else {
    await ensureDbcOpenPlatform();
    return await window.dbcOpenPlatform[endpoint](args);
  }
}

export function faust2basis(faust) {
  return `870970-basis:${
    faust >= 100000000
      ? String(faust)
      : String(100000000 + +faust).slice(1)
  }`;
}
export function basis2faust(basis) {
  return +basis.split(':')[1];
}
export let openplatform = {};
for (const endpoint of endpoints) {
  openplatform[endpoint] = o => op(endpoint, o);
}

export async function getWork(pid) {
  try {
    return await bibDB.get(pid);
  } catch (e) {
    const workReq = openplatform.work({pids: [pid]});
    const collectionReq = openplatform.work({
      pids: [pid],
      fields: ['collection']
    });
    const hasCoverReq = getSpecificCover(pid);
    const recommend = await openplatform.recommend({
      like: [pid],
      limit: 256
    });
    const [work] = await workReq;
    const [{collection}] = await collectionReq;
    const hasCover = !!(await hasCoverReq);
    work.collection = collection;
    work.hasCover = hasCover;
    work.recommend = recommend.map(({pid, val}) => ({pid, val}));
    work._id = pid;
    bibDB.put(work);
    return work;
  }
}
