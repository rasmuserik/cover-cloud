import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { SpriteManager } from "@babylonjs/core/Sprites/spriteManager";
import { Sprite } from "@babylonjs/core/Sprites/sprite";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { SimpleMaterial as Material } from "@babylonjs/materials/simple";
import _ from "lodash";
// createXXX methods from mesh
import "@babylonjs/core/Meshes/meshBuilder";
const levelup = require("levelup");
const leveljs = require("level-js");
const imageCache = levelup(leveljs("images"));

function loadScript(url) {
  return new Promise((resolve, reject) => {
    const elem = document.createElement("script");
    elem.src = url;
    elem.onload = resolve;
    elem.onerror = reject;
    document.head.appendChild(elem);
  });
}

async function getCover(pid) {
  try {
    return JSON.parse(await imageCache.get(pid));
  } catch (e) {
    console.log(e);
    const { coverDataUrlFull } = (await window.dbcOpenPlatform.work({
      pids: [pid],
      fields: ["coverDataUrlFull"]
    }))[0];
    const src = coverDataUrlFull && coverDataUrlFull[0];
    if (!src) {
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

(async () => {
  console.log("request open platform");
  await loadScript("https://openplatform.dbc.dk/v3/dbc_openplatform.min.js");
  await window.dbcOpenPlatform.connect(
    "74b14121-aa23-4e53-b5ef-522850a13f5e",
    "4122efb022161deef3d812a92d309043ddd5c39fcbedaf92fb0240f326889077"
  );
  console.log("got openplatform");
  console.log(await getCover("870970-basis:29644160"));
  let recommended = await window.dbcOpenPlatform.recommend({
    like: ["870970-basis:29644160"],
    limit: 100
  });
  recommended = await Promise.all(
    recommended.map(async o => ({ ...o, cover: await getCover(o.pid) }))
  );
  recommended = recommended.filter(o => o.cover);
  recommended = recommended.map(o => ({ ...o, ...o.cover }));

  await createScene({ imgs: recommended });
  engine.runRenderLoop(() => {
    scene.render();
  });
})();

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

const canvas = document.getElementById("renderCanvas");
const engine = new Engine(canvas);
var scene = new Scene(engine);

async function createScene({ imgs }) {
  // Create camera and light
  var light = new PointLight("Point", new Vector3(5, 10, 5), scene);
  var camera = new ArcRotateCamera(
    "Camera",
    1,
    2,
    14,
    new Vector3(0, 0, 0),
    scene
  );
  camera.attachControl(canvas, true);

  for (let i = 0; i < imgs.length; ++i) {
    const width = imgs[i].width;
    const height = imgs[i].height;
    const size = Math.sqrt(width * width + height * height);
    const spriteManager = new SpriteManager(
      "cover" + i,
      imgs[i].src,
      1,
      { width, height },
      scene
    );
    const sprite = new Sprite("cover", spriteManager);
    sprite.position.x = rnd() * 5;
    sprite.position.y = rnd() * 2 + 2;
    sprite.position.z = rnd() * 5;
    sprite.width = width / size;
    sprite.height = height / size;
  }

  return scene;
}
