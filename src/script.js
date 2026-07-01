import "./style.css";
import * as THREE from "three";
import CameraControls from "camera-controls";
// import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
// import * as dat from 'lil-gui'
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { TWEEN } from "three/examples/jsm/libs/tween.module.min";
// import Stats from 'three/examples/jsm/libs/stats.module'
import { Vector3 } from "three";

CameraControls.install({ THREE: THREE });

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min; //Максимум и минимум включаются
}
function getRandomArbitrary(min, max) {
    return Math.random() * (max - min) + min;
}

const clock = new THREE.Clock();
const EPS = 1e-5;
let raycaster;
let INTERSECTED = null;
let pointer = new THREE.Vector2();
let loaded = false;
let pxWall = [];
let nxWall = [];
let pzWall = [];
let nzWall = [];
let hideModeList = [];
let spriteList = [];
let sceneStatus = {};
let exrCubeRenderTarget;
let exrBackground;
let video;
let tv_screen;
let offsetY = 0;
let twOffset = { y: 0 };
let furnitureOpacity = { opacity: 1 };
let materials = [];
let mouse = { delta: 6, startX: 0, startY: 0 };
let points = [];

points.push({
    position: new THREE.Vector3(-5, 1, -3),
    element: document.querySelector(".point-0"),
});
points.push({
    position: new THREE.Vector3(-1.48, 1.6, -1),
    element: document.querySelector(".point-1"),
});
points.push({
    position: new THREE.Vector3(2.68, 1.56, -0.75),
    element: document.querySelector(".point-2"),
});

sceneStatus.furniture = true;
sceneStatus.roomSprites = true;
sceneStatus.firstPersonView = false;
sceneStatus.initialState;
sceneStatus.rendered = false;
sceneStatus.moving = true;
sceneStatus.attentionPoints = false;
sceneStatus.autoRotate = false;
sceneStatus.video = false;

/**
 * Loaders
 */

const loadingManager = new THREE.LoadingManager(
    // Loaded
    () => {
        document.getElementsByClassName("bar")[0].style.width = "100%";
        window.setTimeout(() => {
            document.querySelector(".bar").style.visibility = "hidden";
            document.querySelector(".overlay").style.visibility = "hidden";
            document.querySelector(".progress").style.visibility = "hidden";
            document.querySelector(".webgl").style.visibility = "visible";
            tick();
        }, 1000);
    },
    // Progress
    (itemUrl, itemsLoaded, itemsTotal) => {
        const progressRatio = itemsLoaded / (itemsTotal + 1);
        document.getElementsByClassName("bar")[0].style.width = `${
            progressRatio * 100
        }%`;
    }
);

const dracoLoader = new DRACOLoader(loadingManager);
dracoLoader.setDecoderPath("draco/");

const gltfLoader = new GLTFLoader(loadingManager);
gltfLoader.setDRACOLoader(dracoLoader);
const cubeTextureLoader = new THREE.CubeTextureLoader(loadingManager);
const textureLoader = new THREE.TextureLoader(loadingManager);

/**
 * Base
 */

if (sceneStatus.video == true) {
    video = document.createElement('video');
    video.style = "display: none; "
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.src = "video/dubai.mp4";
    document.body.appendChild(video);
}


//  const stats = Stats()
//  document.body.appendChild(stats.dom)

// Debug
/* const gui = new dat.GUI({closed: true})
gui.close();
gui.hide();
gui.add(sceneStatus, 'furniture',).onChange((value)=>{
    let opacityTween = new TWEEN.Tween(furnitureOpacity)
        .to({opacity: Number(value)}, 700)
        .easing(TWEEN.Easing.Cubic.InOut) // Use an easing function to make the animation smooth.
        .onStart(() => {
            hideModeList.map((element) => {
                element.material.transparent = true;
            });
        })
        .onUpdate(() => {
            // Called after tween.js updates 'coords'.
            // Move 'box' to the position described by 'coords' with a CSS translation.
            hideModeList.map((element) => {
                element.material.opacity = furnitureOpacity.opacity;
                if (element.material.opacity == 0) {
                    element.visible = false;
                }
                else {
                    element.visible = true;
                }
            })
            
        })
        .onComplete(() => {
            hideModeList.map((element) => {
                element.material.transparent = false;
            });
        })
        .start() // Start the tween immediately.    
});
gui.add(sceneStatus, 'roomSprites',).onChange(()=>{
    spriteList.map((element) => {
        element.visible = sceneStatus.roomSprites;
    })
});

let upButton = { 
    UP: function()
    { 
        offsetY += .3;
        hideModeList.forEach((child) =>
        {
            child.position.setY(child.position.y + .3);

        });
    }};
gui.add(upButton,'UP');

let downButton = { 
    DOWN: function()
    { 
        
        hideModeList.forEach((child) =>
        {
            child.personalOffset = getRandomArbitrary(0.2, 2);
            child.position.setY(child.originalY + child.personalOffset);
            // child.position .setY(child.originalY + twOffset.y);
            child.tween = new TWEEN.Tween(child)
            .to({personalOffset: 0}, getRandomInt(100, 1000))
            .easing(TWEEN.Easing.Quadratic.Out) // Use an easing function to make the animation smooth.
            .onUpdate(() => {
                // Called after tween.js updates 'coords'.
                // Move 'box' to the position described by 'coords' with a CSS translation.
                child.position.setY(child.originalY + child.personalOffset);
            })
            .start() // Start the tween immediately.  
        });
    }};

gui.add(downButton,'DOWN');
*/
const debugObject = {};

// Canvas
const canvas = document.querySelector("canvas.webgl");

// Scene
const scene = new THREE.Scene();

/**
 * Update all materials
 */

const bakedWallsTexture = textureLoader.load(
    "textures/walls_in_hidemode.jpg",
    (texture) => {
        texture.flipY = false;
    }
);
bakedWallsTexture.flipY = false;
bakedWallsTexture.encoding = THREE.sRGBEncoding;
const bakedWallsMaterial = new THREE.MeshBasicMaterial({
    map: bakedWallsTexture,
});

const bakedFloorTexture = textureLoader.load(
    "textures/floor_in_hidemode.jpg",
    (texture) => {
        texture.flipY = false;
    }
);
bakedFloorTexture.flipY = false;
bakedFloorTexture.encoding = THREE.sRGBEncoding;
const bakedFloorMaterial = new THREE.MeshBasicMaterial({
    map: bakedFloorTexture,
});

const bakedCeilingTexture = textureLoader.load(
    "textures/ceiling.jpg",
    (texture) => {
        texture.flipY = false;
    }
);
bakedFloorTexture.encoding = THREE.sRGBEncoding;
const bakedCeilingMaterial = new THREE.MeshBasicMaterial({
    map: bakedCeilingTexture,
});
// bakedCeilingMaterial.side = THREE.DoubleSide;
// console.log(bakedCeilingTexture);

// const dubaiTexture = textureLoader.load("/textures/dubai.jpg");
var glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0.25,
    roughness: 0,
    transmission: 1.0,
});

let videoTexture, videoMaterial;

if (sceneStatus.video == true) {
    videoTexture = new THREE.VideoTexture( video );
    // videoTexture.needsUpdate = true;
    videoMaterial = new THREE.MeshBasicMaterial( {
        map: videoTexture, metalness: 0.25, roughness: 0
    } );
    // videoMaterial.needsUpdate = true;
}

/* gui.add(glassMaterial, 'metalness').min(0).max(1).step(0.01);
gui.add(glassMaterial, 'transmission').min(0).max(1).step(0.01);
gui.add(glassMaterial, 'reflectivity').min(0).max(1).step(0.01);
gui.add(glassMaterial, 'sheen').min(0).max(1).step(0.01);
gui.add(glassMaterial, 'ior').min(1).max(2.333).step(0.01); 
gui.add(glassMaterial, 'specularIntensity').min(0).max(1).step(0.01);
gui.add(glassMaterial, 'thickness').min(0).max(1).step(0.01); */
const updateAllMaterials = (group) => {
    group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
            child.renderOrder = 5;
            if (child.name.indexOf("wall_baked") !== -1) {
                child.material = bakedWallsMaterial;
            }
            if (child.name.indexOf("floor_baked") !== -1) {
                child.renderOrder = 1;
                child.material = bakedFloorMaterial;
            }

            if (child.name.indexOf("ceiling") !== -1) {
                child.renderOrder = 1;
                child.material = bakedCeilingMaterial;
            }

            if (child.name.indexOf("_glass") !== -1) {
                child.transparent = true;
                child.material = glassMaterial;
                child.renderOrder = 10;
            }

            if (sceneStatus.video == true) {
                if (child.name.indexOf('tv_screen') !== -1) {
                    tv_screen = child;
                    child.material = videoMaterial;
                    // console.log('applying video');
                    // console.log(child);
                }
            }

            if (
                child.parent.name.indexOf("PX_") !== -1 ||
                child.name.indexOf("PX_") !== -1
            ) {
                pxWall.push(child);
                child.material = child.material.clone();
                child.material.transparent = true;
                child.renderOrder = 0;
            }
            if (
                child.parent.name.indexOf("NX_") !== -1 ||
                child.name.indexOf("NX_") !== -1
            ) {
                nxWall.push(child);
                child.material = child.material.clone();
                child.material.transparent = true;
                child.renderOrder = 0;
            }
            if (
                child.parent.name.indexOf("PZ_") !== -1 ||
                child.name.indexOf("PZ_") !== -1
            ) {
                pzWall.push(child);
                child.material = child.material.clone();
                child.material.transparent = true;
                child.renderOrder = 0;
            }
            if (
                child.parent.name.indexOf("NZ_") !== -1 ||
                child.name.indexOf("NZ_") !== -1
            ) {
                nzWall.push(child);
                child.material = child.material.clone();
                child.material.transparent = true;
                child.renderOrder = 0;
            }
            // if(child instanceof THREE.Mesh)
            // {
            // child.material = material;
            // child.material.envMap = environmentMap
            // child.material.envMapIntensity = debugObject.envMapIntensity
            // child.castShadow = true
            // child.receiveShadow = true
            // }
            if (
                child.parent.name.indexOf("hidemode") !== -1 ||
                child.name.indexOf("hidemode") !== -1
            ) {
                hideModeList.push(child);
                child.originalY = child.position.y;
                child.material = child.material.clone();
                // child.material.transparent = true;
                child.renderOrder = 5;
            }
            if (
                child.material instanceof THREE.MeshStandardMaterial) {
                child.material.envMap = environmentMap;
                // child.material.envMapIntensity = debugObject.envMapIntensity;
                child.castShadow = false;
                child.receiveShadow = false;
                // child.transparent = true
                // console.log(child.name.indexOf('Стен'))
                // if (child.name )
                // const helper = new VertexNormalsHelper( child, 1, 0x00ff00 );
                // scene.add( helper );
            }
            if (
                child.parent.name.indexOf("lamp") !== -1 ||
                child.name.indexOf("lamp") !== -1
            ) {
                // child.material.depthTest = false;
                child.renderOrder = 11;
            }
            if (child.name.indexOf("sofa") !== -1) {
                // child.material.depthTest = false;
                materials.push(child.material);
                var conf = { color: "#ffae23" };
                // gui.addColor(conf, 'color').onChange( function(colorValue) {
                //     materials.map((element)=>{
                //         element.color.set(colorValue);
                //     })
                //     // child.material.map = null;
                //     // child.material.envMap = null;
                //     // child.material.color.set(colorValue);
                // });
            }
        }
    });
};

/**
 * Environment map
 */
// const environmentMap = cubeTextureLoader.load([
//     '/textures/environmentMaps/0/px.jpg',
//     '/textures/environmentMaps/0/nx.jpg',
//     '/textures/environmentMaps/0/py.jpg',
//     '/textures/environmentMaps/0/ny.jpg',
//     '/textures/environmentMaps/0/pz.jpg',
//     '/textures/environmentMaps/0/nz.jpg'
// ])

const environmentMap = cubeTextureLoader.load([
    "textures/environmentMaps/4/px.png",
    "textures/environmentMaps/4/nx.png",
    "textures/environmentMaps/4/py.png",
    "textures/environmentMaps/4/ny.png",
    "textures/environmentMaps/4/pz.png",
    "textures/environmentMaps/4/nz.png",
]);

environmentMap.encoding = THREE.sRGBEncoding;

scene.background = environmentMap;
// scene.background = dubaiTexture;
scene.background = new THREE.Color(0xffffff);
// scene.background = new THREE.Color(0x00ff55);
// scene.environment = environmentMap

debugObject.envMapIntensity = 2;
// gui.add(debugObject, 'envMapIntensity').min(0).max(10).step(0.001).onChange(updateAllMaterials)

/**
 * Models
 */
// console.log("loading model");
// console.takeHeapSnapshot("loading model");
gltfLoader.load("models/v8-draco/apartment.gltf", (gltf) => {
    // console.log("model loaded");
    // console.takeHeapSnapshot("model loaded");
    gltf.scene.position.set(0, 0, 0);
    // gui.add(gltf.scene.rotation, 'y').min(- Math.PI).max(Math.PI).step(0.001).name('rotation')

    updateAllMaterials(gltf.scene);
    // console.takeHeapSnapshot("materials updated");
    scene.add(gltf.scene);
    // console.takeHeapSnapshot("added to scene");
    // if ( navigator.mediaDevices && navigator.mediaDevices.getUserMedia ) {

    //     const constraints = { video: { width: 720, height: 720} };

    //     navigator.mediaDevices.getUserMedia( constraints ).then( function ( stream ) {

    //         // apply the stream to the video element used in the texture

    //         video.srcObject = stream;
    //         video.play();

    //     } ).catch( function ( error ) {

    //         console.error( 'Unable to access the camera/webcam.', error );

    //     } );

    // } else {

    //     console.error( 'MediaDevices interface not available.' );

    // }
    // const planegeometry = new THREE.PlaneGeometry( 16, 9 );
    // // planegeometry.scale( 0.3, 0.3, 0.3 );

    // const planemesh = new THREE.Mesh( planegeometry, videoMaterial);
    // planemesh.position.set(0, 3, 0);
    // planemesh.rotation.set( 0, Math.PI / 2, 0 );
    // scene.add(planemesh);
    if (sceneStatus.video == true) {
        video.play();
    }
    // console.log(pxWall)
    // console.log(hideModeList);
    // console.log(materials);
    loaded = true;
});

/**
 * Sprites
 */
const mapLivingRoom = new THREE.TextureLoader().load(
    "textures/livingroom.svg"
);
const spriteMaterialLivingRoom = new THREE.SpriteMaterial({
    map: mapLivingRoom,
});
spriteMaterialLivingRoom.sizeAttenuation = false;

const spriteLivingRoom = new THREE.Sprite(spriteMaterialLivingRoom);
spriteLivingRoom.position.set(1.5, 2.5, -2.5);
spriteLivingRoom.scale.set(0.05, 0.05, 0.05);

const mapKitchen = new THREE.TextureLoader().load("textures/kitchen.svg");
const spriteMaterialKitchen = new THREE.SpriteMaterial({ map: mapKitchen });
spriteMaterialKitchen.sizeAttenuation = false;

const spriteKitchen = new THREE.Sprite(spriteMaterialKitchen);
spriteKitchen.position.set(1.5, 2.5, 1);
spriteKitchen.scale.set(0.05, 0.05, 0.05);

const mapBathroom = new THREE.TextureLoader().load("textures/bathroom.svg");
const spriteMaterialBathroom = new THREE.SpriteMaterial({ map: mapBathroom });
spriteMaterialBathroom.sizeAttenuation = false;

const spriteBathroom = new THREE.Sprite(spriteMaterialBathroom);
spriteBathroom.position.set(-2.1, 2.5, 0.5);
spriteBathroom.scale.set(0.05, 0.05, 0.05);

const mapBedroom = new THREE.TextureLoader().load("textures/bedroom.svg");
const spriteMaterialBedroom = new THREE.SpriteMaterial({ map: mapBedroom });
spriteMaterialBedroom.sizeAttenuation = false;
const spriteBedroom = new THREE.Sprite(spriteMaterialBedroom);
spriteBedroom.position.set(-5, 1, -2.85);
spriteBedroom.scale.set(0.2, 0.2, 0.2);
// scene.add(spriteBedroom);

// scene.add(spriteLivingRoom, spriteKitchen, spriteBathroom, spriteBedroom);
spriteList.push(spriteLivingRoom, spriteKitchen, spriteBathroom);

// gui.add(spriteKitchen.position, 'y').min(- 5).max(5).step(0.001).name('spriteY')
// gui.add(spriteKitchen.position, 'z').min(- 5).max(5).step(0.001).name('spriteZ')
// gui.add(spriteKitchen.position, 'x').min(- 5).max(5).step(0.001).name('spriteX')

//SVG

// const fileLoader = new THREE.FileLoader();
// fileLoader.load( '/textures/livingroom.svg', function ( svg ) {

//     const node = document.createElementNS( 'http://www.w3.org/2000/svg', 'g' );
//     const parser = new DOMParser();
//     const doc = parser.parseFromString( svg, 'image/svg+xml' );

//     node.appendChild( doc.documentElement );

//     const object = new SVGObject( node );
//     object.position.set(1.5, 2, -1)
//     scene.add( object );

// } );

/**
 * Sizes
 */
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight,
};

window.addEventListener("resize", () => {
    // Update sizes
    sizes.width = window.innerWidth;
    sizes.height = window.innerHeight;

    // Update camera
    camera.aspect = sizes.width / sizes.height;
    camera.updateProjectionMatrix();

    // Update renderer
    renderer.setSize(sizes.width, sizes.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

document.addEventListener("mousemove", onPointerMove);

document.addEventListener("mousedown", function (event) {
    mouse.startX = event.pageX;
    mouse.startY = event.pageY;
});

document.addEventListener("mouseup", function (event) {
    const diffX = Math.abs(event.pageX - mouse.startX);
    const diffY = Math.abs(event.pageY - mouse.startY);

    if (diffX < mouse.delta && diffY < mouse.delta) {
        // console.log(event);
        //   console.log(INTERSECTED);
        // console.log(INTERSECTED.point);
        // console.log("getWorldDirection:");
        // console.log(camera.getWorldDirection(new Vector3));
        if (event.target == canvas) {
            let newPosition = INTERSECTED.point.clone();
            newPosition.add(INTERSECTED.face.normal);
            newPosition.setY(EPS);
            cameraControls.maxPolarAngle = Math.PI;
            if (sceneStatus.firstPersonView == false) {
                // cameraControls.saveState();
                sceneStatus.firstPersonView = true;
                cameraControls.minZoom = 0.5;
                cameraControls.maxZoom = 2;
                cameraControls.azimuthRotateSpeed = -0.8; // negative value to invert rotation direction
                cameraControls.polarRotateSpeed = -0.8; // negative value to invert rotation direction
                cameraControls.truckSpeed = 1;
                cameraControls.mouseButtons.wheel = CameraControls.ACTION.ZOOM;
                cameraControls.touches.two = CameraControls.ACTION.TOUCH_ZOOM;
                cameraControls.setLookAt(
                    newPosition.x,
                    1.6,
                    newPosition.z,
                    newPosition.x,
                    1.6,
                    newPosition.z + EPS,
                    true
                );
                cameraControls.zoomTo(1.2, true);
            } else {
                cameraControls.moveTo(
                    newPosition.x,
                    1.6,
                    newPosition.z + EPS,
                    true
                );
            }
            // console.log(newPosition);

            // cameraControls.setOrbitPoint(0,0,0);
            // cameraControls.moveTo(newPosition.x, 1.6, newPosition.z);
            // cameraControls.setPosition(newPosition.x, 1.6, newPosition.z, true);

            // console.log(cameraControls.toJSON());
            //   camera.position.copy(newPosition);
            //   controls.enabled = true;
            // console.log(INTERSECTED.point);
            // //   console.log(newPosition);
            // //   console.log(camera.position);
            // //   console.log(camera);
            //   cameraControls.update();
            //   camera.updateProjectionMatrix();
            // console.log(camera.position.dot(points[0].position));
            // console.log(camera.position.dot(points[1].position));
            // console.log(camera.position.dot(points[2].position));
        } else {
            // console.log("drag");
            // console.log(camera);
        }
    }
});

document.getElementById("reloadButton").onclick = function () {
    if (loaded) {
        cameraControls.maxZoom = 3;
        cameraControls.minZoom = 1;
        sceneStatus.firstPersonView = false;
        cameraControls.zoomTo(2, true);
        cameraControls.setLookAt(0, 20, 0, 0, 0, 0, true);
        cameraControls.azimuthRotateSpeed = 0.8; // negative value to invert rotation direction
        cameraControls.polarRotateSpeed = 0.8;
        cameraControls.maxPolarAngle = (85 * Math.PI) / 180;
    }
};
document.getElementById("furnitureButton").onclick = function () {
    if (loaded) {
        sceneStatus.furniture = !sceneStatus.furniture;
        let opacityTween = new TWEEN.Tween(furnitureOpacity)
            .to({ opacity: Number(sceneStatus.furniture) }, 700)
            .easing(TWEEN.Easing.Cubic.InOut) // Use an easing function to make the animation smooth.
            .onStart(() => {
                hideModeList.map((element) => {
                    element.material.transparent = true;
                });
            })
            .onUpdate(() => {
                // Called after tween.js updates 'coords'.
                // Move 'box' to the position described by 'coords' with a CSS translation.
                hideModeList.map((element) => {
                    element.material.opacity = furnitureOpacity.opacity;
                    if (element.material.opacity == 0) {
                        element.visible = false;
                    } else {
                        element.visible = true;
                    }
                });
            })
            .onComplete(() => {
                hideModeList.map((element) => {
                    element.material.transparent = false;
                });
            })
            .start(); // Start the tween immediately.
    }
};

document.getElementById("featuresButton").onclick = function () {
    if (loaded) {
        sceneStatus.attentionPoints = !sceneStatus.attentionPoints;
    }
};

function onPointerMove(event) {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

raycaster = new THREE.Raycaster();

/**
 * Camera
 */
// Base camera
const camera = new THREE.PerspectiveCamera(
    85,
    sizes.width / sizes.height,
    0.1,
    100
);
camera.position.set(0, 20, 0);
camera.lookAt(0, 0, 0);
scene.add(camera);
// gui.add(camera, 'fov').min(10).max(100).step(1).onChange(()=>{
//     camera.updateProjectionMatrix();
//     // console.log(`focalLength: ${camera.getFocalLength()}, zoom: ${camera.zoom}, fov: ${camera.fov}`);
// })
// const cameraHelper = new THREE.CameraHelper( camera );
//  scene.add( cameraHelper );

// Controls
// const controls = new OrbitControls(camera, canvas)
// controls.enableDamping = true
// controls.maxDistance = 20
// controls.minDistance = 9
// gui.add(controls, 'minDistance').min(0).max(10).step(0.001)
// controls.rotateSpeed = .8
// gui.add(controls, 'rotateSpeed').min(0).max(10).step(0.001)
// controls.maxPolarAngle = 85 * Math.PI / 180
// controls.enablePan = false
// console.log(controls.getAzimuthalAngle())

const cameraControls = new CameraControls(camera, canvas);
cameraControls.enableDamping = true;
// cameraControls.maxDistance = 20
// cameraControls.minDistance = 9
cameraControls.maxZoom = 3;
cameraControls.minZoom = 1;
cameraControls.rotateSpeed = 0.8;
cameraControls.maxPolarAngle = (85 * Math.PI) / 180;
cameraControls.dollyToCursor = true;
cameraControls.mouseButtons.wheel = CameraControls.ACTION.ZOOM;
// controls.enablePan = false
cameraControls.dollyToCursor = false;
cameraControls.zoomTo(2, true);
cameraControls.saveState();
sceneStatus.initialState = cameraControls.toJSON();

// cameraControls.addEventListener( 'controlstart', ()=>{
//     console.log('controlstart');
// });
cameraControls.addEventListener("control", () => {
    // console.log("control");
    sceneStatus.moving = true;
});
cameraControls.addEventListener("controlend", () => {
    // console.log("controlend");
    sceneStatus.moving = false;
});
// cameraControls.addEventListener( 'transitionstart', ()=>{
//     console.log('transitionstart');
// });
// cameraControls.addEventListener( 'update', ()=>{
//     console.log('update');
// });
cameraControls.addEventListener("wake", () => {
    // console.log("wake");
    sceneStatus.moving = true;
});
cameraControls.addEventListener("rest", () => {
    // console.log("rest");
    sceneStatus.moving = false;
});
cameraControls.addEventListener("sleep", () => {
    // console.log("sleep");
    sceneStatus.moving = false;
});

// let resetButtons = {
//     reset: function()
//     {
//         if (sceneStatus.firstPersonView == true) {
//             sceneStatus.firstPersonView = false;
//             scene.traverse((element) => {
//             if (element instanceof THREE.Mesh && element.name.indexOf('_glass') == -1) {

//                 element.material.transparent = true;
//             }
//             });
//         cameraControls.reset(true);
//         }
//         else {
//             console.log(sceneStatus.initialState);
//             cameraControls.fromJSON(sceneStatus.initialState, true);
//         }
//         cameraControls.azimuthRotateSpeed = 0.8; // negative value to invert rotation direction
//         cameraControls.polarRotateSpeed   = 0.8;
//     }};
// gui.add(resetButtons,'reset');

let resetButtons = {
    resetToTop: function () {
        // console.log("restoring initial state view...");
        // console.log(sceneStatus.initialState);
        // cameraControls.fromJSON(sceneStatus.initialState, true);
        // cameraControls.zoom(1);
        // cameraControls.setTarget(0,0,0);
        // cameraControls.setPosition(0, 20, 0, true);
        cameraControls.maxZoom = 3;
        cameraControls.minZoom = 1;
        sceneStatus.firstPersonView = false;
        cameraControls.zoomTo(2, true);
        cameraControls.setLookAt(0, 20, 0, 0, 0, 0, true);
        cameraControls.azimuthRotateSpeed = 0.8; // negative value to invert rotation direction
        cameraControls.polarRotateSpeed = 0.8;
    },
};
// gui.add(resetButtons,'resetToTop').name("Initial view");

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
});
renderer.physicallyCorrectLights = false;
renderer.outputEncoding = THREE.sRGBEncoding;
// renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMapping = THREE.NoToneMapping;
renderer.toneMappingExposure = 1;
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.sortObjects = true;
// renderer.autoClear = false;

// gui
//     .add(renderer, 'toneMapping', {
//         No: THREE.NoToneMapping,
//         Linear: THREE.LinearToneMapping,
//         Reinhard: THREE.ReinhardToneMapping,
//         Cineon: THREE.CineonToneMapping,
//         ACESFilmic: THREE.ACESFilmicToneMapping
//     })
// gui.add(renderer, 'toneMappingExposure').min(0).max(10).step(0.001);

/**
 * Normals
 */
const px = new THREE.Vector3(1, 0, 0);
const nx = new THREE.Vector3(-1, 0, 0);
const pz = new THREE.Vector3(0, 0, 1);
const nz = new THREE.Vector3(0, 0, -1);

/**
 * Groups
 */
//PX
//Plane036

const planeGeometry = new THREE.PlaneGeometry(0.3, 0.3);
const planeTexture = textureLoader.load("move_pointer.png");
const planeMaterial = new THREE.MeshBasicMaterial({ map: planeTexture });
planeMaterial.transparent = true;
const planePointer = new THREE.Mesh(planeGeometry, planeMaterial);
planePointer.renderOrder = 999;
//  planePointer.onBeforeRender = function( renderer ) { renderer.clearDepth(); };
planePointer.visible = false;
planeMaterial.depthTest = false;
scene.add(planePointer);

/**
 * Animate
 */
const tick = () => {
    // console.log(camera)

    // Update controls
    // controls.update()
    const delta = clock.getDelta();
    cameraControls.update(delta);
    TWEEN.update();
    // stats.update();
    // console.log(camera.position.toArray())

    if (loaded) {
        raycaster.setFromCamera(pointer, camera);
        const intersects = raycaster.intersectObjects(
            scene.children[2].children,
            true
        );

        if (intersects.length > 0) {
            // console.log(intersects[0]);
            // console.log(typeof intersects[0].object);
            for (let i = 0; i < intersects.length; i++) {
                // console.log(intersects[i]);
                if (intersects[i].object.visible === true) {
                    // console.log(typeof intersects[0].object);
                    planePointer.position.set(0, 0, 0);
                    planePointer.lookAt(intersects[i].face.normal);
                    planePointer.position.copy(intersects[i].point);
                    planePointer.visible = true;
                    INTERSECTED = intersects[i];

                    break;
                } else {
                    continue;
                    INTERSECTED = null;
                }
            }
            // planePointer.position.set(0,0,0);
            // planePointer.lookAt(intersects[0].face.normal);
            // planePointer.position.copy(intersects[0].point);
            // planePointer.visible = true;
        } else {
            planePointer.visible = false;
        }
        if (sceneStatus.attentionPoints == true) {
            if (sceneStatus.moving == false) {
                for (const point of points) {
                    // Get 2D screen position
                    const screenPosition = point.position.clone();
                    screenPosition.project(camera);

                    // Set the raycaster
                    raycaster.setFromCamera(screenPosition, camera);
                    const intersects = raycaster.intersectObjects(
                        scene.children[2].children,
                        true
                    );

                    // No intersect found
                    if (intersects.length === 0) {
                        // Show
                        point.element.classList.add("visible");
                    }

                    // Intersect found
                    else {
                        const frustum = new THREE.Frustum();
                        const matrix = new THREE.Matrix4().multiplyMatrices(
                            camera.projectionMatrix,
                            camera.matrixWorldInverse
                        );
                        frustum.setFromProjectionMatrix(matrix);
                        if (frustum.containsPoint(point.position)) {
                            // console.log('Out of view')
                            // Get the distance of the intersection and the distance of the point
                            const intersectionDistance = intersects[0].distance;
                            const pointDistance = point.position.distanceTo(
                                camera.position
                            );

                            // Intersection is close than the point
                            if (intersectionDistance < pointDistance) {
                                // Hide
                                point.element.classList.remove("visible");
                            }
                            // Intersection is further than the point
                            else {
                                // Show
                                point.element.classList.add("visible");
                            }
                        }
                    }

                    // const translateX = (screenPosition.x * sizes.width * 0.5).toFixed(2);
                    // const translateY = (- screenPosition.y * sizes.height * 0.5).toFixed(2);
                    // point.element.style.transform = `translateX(${translateX}px) translateY(${translateY}px)`
                    point.element.style = `left: ${
                        ((screenPosition.x + 1) * window.innerWidth) / 2
                    }px; top: ${
                        (-(screenPosition.y - 1) * innerHeight) / 2
                    }px;`;
                }
            } else {
                for (const point of points) {
                    point.element.classList.remove("visible");
                }
            }
        }

        if (sceneStatus.autoRotate == true) {

            cameraControls.azimuthAngle += 50 * delta * THREE.MathUtils.DEG2RAD;
    
        }

    }

    // if ( v.subVectors( camera.position, this.position ).dot( this.userData.normal ) < 0 )
    // let cameraVector = camera.position.clone();
    let cameraVectorNormalized = camera.position.clone().normalize();
    if (camera.position.dot(px) >= 0 && sceneStatus.firstPersonView == false) {
        // console.log(camera.position.dot( px ));
        pxWall.map((element) => {
            element.material.opacity = 1 - cameraVectorNormalized.dot(px) * 2;
            if (element.material.opacity <= 0) {
                element.visible = false;
            } else {
                element.visible = true;
            }
        });
    }
    if (camera.position.dot(px) < 0) {
        pxWall.map((element) => {
            element.material.opacity = 1;
            element.visible = true;
        });
    }
    if (camera.position.dot(pz) >= 0 && sceneStatus.firstPersonView == false) {
        pzWall.map((element) => {
            element.material.opacity = 1 - cameraVectorNormalized.dot(pz) * 2;
            if (element.material.opacity <= 0) {
                element.visible = false;
            } else {
                element.visible = true;
            }
        });
    }
    if (camera.position.dot(pz) < 0) {
        pzWall.map((element) => {
            element.material.opacity = 1;
            element.visible = true;
        });
    }
    if (camera.position.dot(nx) >= 0 && sceneStatus.firstPersonView == false) {
        nxWall.map((element) => {
            element.material.opacity = 1 - cameraVectorNormalized.dot(nx) * 2;
            if (element.material.opacity <= 0) {
                element.visible = false;
            } else {
                element.visible = true;
            }
        });
    }
    if (camera.position.dot(nx) < 0) {
        nxWall.map((element) => {
            element.material.opacity = 1;
            element.visible = true;
        });
    }
    if (camera.position.dot(nz) >= 0 && sceneStatus.firstPersonView == false) {
        nzWall.map((element) => {
            element.material.opacity = 1 - cameraVectorNormalized.dot(nz) * 2;
            if (element.material.opacity <= 0) {
                element.visible = false;
            } else {
                element.visible = true;
            }
        });
    }
    if (camera.position.dot(nz) < 0) {
        nzWall.map((element) => {
            element.material.opacity = 1;
            element.visible = true;
        });
    }

    // if (typeof tv_screen === 'object') {
    //     let boundingBox = new THREE.Box3().setFromObject(tv_screen)
    //     let size = boundingBox.getSize() // Returns Vector3
    //     console.log(size)
    // }

    // Render
    // console.log('before clearDepth');
    renderer.clearDepth();
    // console.log('before render');
    renderer.render(scene, camera);
    // console.log('after render');
    // Call tick again on the next frame
    if (sceneStatus.rendered == false) {
        sceneStatus.rendered = true;
        document.getElementById("controls").classList.add("slide-in-bottom");
    } else {
        // document.getElementById('controls').style.visibility = 'visible';
    }
    window.requestAnimationFrame(tick);
};
//<video id="video" style="display:none" autoplay playsinline></video>
