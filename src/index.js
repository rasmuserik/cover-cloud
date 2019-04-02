import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math";
import { ArcRotateCamera} from "@babylonjs/core/Cameras/arcRotateCamera";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import {SpriteManager} from "@babylonjs/core/Sprites/spriteManager";
import {Sprite} from "@babylonjs/core/Sprites/sprite";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { SimpleMaterial as Material } from "@babylonjs/materials/simple";
import _ from "lodash";
// createXXX methods from mesh
import "@babylonjs/core/Meshes/meshBuilder";

function loadScript(url) {
    return new Promise((resolve, reject) => {
          const elem = document.createElement('script');
          elem.src = url;
          elem.onload = resolve;
          elem.onerror = reject;
          document.head.appendChild(elem);
        });
}

(async () => {
  console.log('request open platform');
        await loadScript(
          'https://openplatform.dbc.dk/v3/dbc_openplatform.min.js'
        );
        await window.dbcOpenPlatform.connect(
          '74b14121-aa23-4e53-b5ef-522850a13f5e',
            '4122efb022161deef3d812a92d309043ddd5c39fcbedaf92fb0240f326889077'
        );
  const {coverDataUrlFull} = (await window.dbcOpenPlatform.work({'pids': ['870970-basis:29644160'], fields: ['coverDataUrlFull']}))[0]
  const img = coverDataUrlFull && coverDataUrlFull[0];
  console.log('got openplatform');
  const elem = document.createElement('img');
  elem.src = img;
  document.body.appendChild(elem);
	console.log(elem);
	window.x = elem;

await createScene({img})
engine.runRenderLoop(() => {
  scene.render();
});

})();



const canvas = document.getElementById("renderCanvas");
const engine = new Engine(canvas);
var scene = new Scene(engine);

async function createScene({img}) {


const count = 100;
    // Create camera and light
    var light = new PointLight("Point", new Vector3(5, 10, 5), scene);
    var camera = new ArcRotateCamera("Camera", 1, 0.8, 8, new Vector3(0, 0, 0), scene);
    camera.attachControl(canvas, true);

    // Create a sprite manager to optimize GPU ressources
    // Parameters : name, imgUrl, capacity, cellSize, scene
    var spriteManagerTrees = new SpriteManager("treesManager", img, count, {width: 262, height: 500}, scene);

    //We create count trees at random positions
    for (var i = 0; i < count; i++) {
        var tree = new Sprite("tree", spriteManagerTrees);
        tree.position.x = Math.random() * 10 - 5;
        tree.position.z = Math.random() * 10 - 5;
        tree.isPickable = true;

        //Some "dead" trees
        if (Math.round(Math.random() * 5) === 0) {
            tree.angle = Math.PI * 90 / 180;
            tree.position.y = -0.3;
        }
    }
return scene;
}


