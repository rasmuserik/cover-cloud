import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { SpriteManager } from "@babylonjs/core/Sprites/spriteManager";
import { Sprite } from "@babylonjs/core/Sprites/sprite";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { SimpleMaterial as Material } from "@babylonjs/materials/simple";
import _ from "lodash";
// createXXX methods from mesh
import "@babylonjs/core/Helpers/sceneHelpers";
import "@babylonjs/core/Meshes/meshBuilder";
const levelup = require("levelup");
const leveljs = require("level-js");
const imageCache = levelup(leveljs("images"));
const relatedCache = levelup(leveljs("related"));
function loadScript(url) {
  return new Promise((resolve, reject) => {
    const elem = document.createElement("script");
    elem.src = url;
    elem.onload = resolve;
    elem.onerror = reject;
    document.head.appendChild(elem);
  });
}
let openplatformRequest;
function ensureOpenplatform() {
  if (!openplatformRequest) {
    openplatformRequest = (async () => {
      console.log("request open platform");
      await loadScript(
        "https://openplatform.dbc.dk/v3/dbc_openplatform.min.js"
      );
      await window.dbcOpenPlatform.connect(
        "74b14121-aa23-4e53-b5ef-522850a13f5e",
        "4122efb022161deef3d812a92d309043ddd5c39fcbedaf92fb0240f326889077"
      );
      console.log("got openplatform");
    })();
  }
  return openplatformRequest;
}
const _related = {};
let relCount = 0;
async function related(pid) {
  if (_related[pid]) {
    return _related[pid];
  }
  let result;
  try {
    result = JSON.parse(await relatedCache.get(pid));
  } catch (e) {
    await ensureOpenplatform();
    result = await window.dbcOpenPlatform.recommend({
      like: [pid],
      limit: 100
    });
    await relatedCache.put(pid, JSON.stringify(result));
    console.log(++relCount, "related", pid);
  }
  _related[pid] = result;
  return result;
}
async function getCover(pid) {
  try {
    return JSON.parse(await imageCache.get(pid));
  } catch (e) {
    await ensureOpenplatform();
    const { coverDataUrl500 } = (await window.dbcOpenPlatform.work({
      pids: [pid],
      fields: ["coverDataUrl500"]
    }))[0];
    const src = coverDataUrl500 && coverDataUrl500[0];
    if (!src) {
      await imageCache.put(pid, 0);
      return null;
    }
    const { width, height } = await new Promise(resolve => {
      const img = document.createElement("img");
      img.src = src;
      img.onload = () => resolve(img);
    });
    const result = { src, width, height };
    await imageCache.put(pid, JSON.stringify(result));
    return result;
  }
}

let pids = [];
let covers = [];
let recommendations = [];
let recMat = [];
let sprites = [];
// positions, velocities, accelerations
let ps = [],
  vs = [],
  as = [];
async function initModel(pid) {
  console.time("recommend");
  let arr = await related(pid);
  console.timeEnd("recommend");

  console.time("covers");
  arr = await Promise.all(
    arr.map(async o => ({ ...o, cover: await getCover(o.pid) }))
  );
  arr = arr.filter(o => o.cover);
  console.timeEnd("covers");

  pids = arr.map(o => o.pid);
  covers = arr.map(o => o.cover);

  console.time("recommend2");
  recommendations = await Promise.all(
    pids.map(async pid => await related(pid))
  );
  console.log(recommendations);
  console.timeEnd("recommend2");

  recMat = pids.map(() => new Float64Array(pids.length));
  for (let i = 0; i < recommendations.length; ++i) {
    for (const o of recommendations[i]) {
      const pos = pids.indexOf(o.pid);
      if (pos !== -1) {
        recMat[i][pos] += o.val;
        recMat[pos][i] += o.val;
      }
    }
  }
  console.log(recMat);

  ps = pids.map(() => new Vector3(rnd() * 10, rnd() * 10, rnd() * 10));
  vs = pids.map(() => Vector3.Zero());
  as = pids.map(() => Vector3.Zero());
}

function updatePos() {
  for (let i = 0; i < pids.length; ++i) {
    const a = Vector3.Zero();
    const p = ps[i];

    const centerDistanceSq = p.lengthSquared();
    const gravity = p.clone().normalize();
    gravity.scaleInPlace(-1 / centerDistanceSq);
    a.addInPlace(gravity);
    a.y -= Math.max(0, 0.01 * p.y - 1);

    const dampening = vs[i].clone();
    dampening.scaleInPlace(-0.6);
    a.addInPlace(dampening);

    for (let j = 0; j < pids.length; ++j) {
      if (i !== j) {
        // spacing
        let d = p.subtract(ps[j]);
        const distSq = p.lengthSquared(p);
        let push = 4 - distSq;
        if (push > 0) {
          push = push * push * push * push;
          d.normalize();
          d.scaleInPlace(push * 0.001);
          a.addInPlace(d);
        }

        // attraction
        d = ps[j].subtract(p);
        d.normalize();
        d.scaleInPlace(recMat[i][j] * 0.001);
        a.addInPlace(d);
      }
    }
    as[i] = a;
  }

  for (let i = 0; i < pids.length; ++i) {
    vs[i] = vs[i].addInPlace(as[i]);
    ps[i] = ps[i].addInPlace(vs[i]);
  }
  setTimeout(updatePos, 0);
}

async function main() {
  let pid;
  pid = "870970-basis:29644160"; // borneboger
  pid = "870970-basis:22331892"; // hesse
  pid = "870970-basis:29841853"; // action movies
  pid = "870970-basis:23726246"; // allende

  await initModel(pid);

  console.time("scene");
  await createScene();
  console.timeEnd("scene");
}
function rnd() {
  return (
    Math.random() +
    Math.random() +
    Math.random() -
    Math.random() -
    Math.random() -
    Math.random()
  );
}
async function createScene() {
  const canvas = document.getElementById("renderCanvas");
  const engine = new Engine(canvas, true);
  var scene = new Scene(engine);
  //var camera = new ArcRotateCamera("Camera", 1, 1, 15, new Vector3(0, 0, 0), scene);
  var camera = new FreeCamera("camera1", new Vector3(0, 2, 0), scene);
  camera.attachControl(canvas, true);
  //  camera.setTarget(Vector3.Zero());
  try {
    var vrHelper = scene.createDefaultVRExperience({
      createDeviceOrientationCamera: false,
      useMultiview: true
    });
  } catch (e) {
    console.log(e);
  }

  var light = new PointLight("Point", new Vector3(5, 10, 5), scene);

  for (let i = 0; i < covers.length; ++i) {
    const width = covers[i].width;
    const height = covers[i].height;
    const size = Math.sqrt(width * width + height * height) * 1.5;
    const spriteManager = new SpriteManager(
      "cover" + i,
      covers[i].src,
      1,
      { width, height },
      scene
    );
    const sprite = new Sprite("cover", spriteManager);
    sprite.width = width / size;
    sprite.height = height / size;
    sprites.push(sprite);
  }

  engine.runRenderLoop(() => {
    for (let i = 0; i < sprites.length; ++i) {
      const p = ps[i];
      sprites[i].position = { x: p.x, y: p.y / 2 + 1.5, z: p.z };
    }
    updatePos();
    scene.render();
  });
}
main();
