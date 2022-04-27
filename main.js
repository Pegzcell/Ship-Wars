import './style.css'

import * as THREE from 'three';

import { Water } from 'three/examples/jsm/objects/Water.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
const loader = new GLTFLoader();

const S ={
  START: 0,
  ON: 1,
  PAUSED: 2,
  ENDED: 3
}
Object.freeze(S)

let camera, BEcamera, scene, renderer;
let water, sun;
let player;

const AREAWIDTH = window.innerWidth/100;
const AREADEPTH = window.innerWidth/50;
const PLAYERSPEED = 0.08
const ENEMYSPEED =0.05
const CHESTSPEED =0.1
const PLAYERHEALTH = 200
const ENEMYHEALTH =50
const CANNON_INTERVAL = 5000
const G = 0.001
const BOUNCE_ACC = 0.0005
const BOUNCE_VEL = 0.1
const CANNON_VEL = 1 
const POS_PLAYER_INIT = [-9,-.1,0]
const CAM_DIST = 100
const CAM_HEIGHT = 30
const CAM_SIDETILT = 20
const VEL_MAX = 10
const BECAM_HEIGHT = 300

let gameState
let camType
let storage
let lastTimeStep
let dt
let Enemy_cannons
let Player_cannons

let chests
let CHEST_COUNT
let chestCurr

let ships
let SHIP_COUNT
let shipCurr

let startTime

let score
let health
let chests_collected
let ships_destroyed
let time_lapsed

resetValues();
function resetValues(){
  gameState=S.START
  camType = 0;
  storage =99999999;
  lastTimeStep = 0;
  dt = 17;
  Enemy_cannons = [];
  Player_cannons = [];

  chests = []
  CHEST_COUNT = 10
  chestCurr = 0;

  ships =[]
  SHIP_COUNT = 4
  shipCurr = 0;

  startTime = 0;

  score =0;
  health = PLAYERHEALTH;
  chests_collected =0;
  ships_destroyed =0;
  time_lapsed = 0;
}

const instructionsElement = document.getElementById("instructions");
const resultsElement = document.getElementById("results");
const hudElement = document.getElementById("hud");

function hudUpdate(){
  if (hudElement) hudElement.innerHTML = (`
  Score : ${score} <br>
  Health : ${health} <br>
  Chests collected : ${chests_collected} <br>
  Ships destroyed : ${ships_destroyed} <br>
  Time lapsed : ${time_lapsed} <br>
  `
  );
}

function random(min, max) {
  return Math.random() * (max - min) + min;
}

function primary(angle){
    // reduce the angle  
    angle =  angle % 360; 

    // force it to be the positive remainder, so that 0 <= angle < 360  
    angle = (angle + 360) % 360;  

    // force into the minimum absolute value residue class, so that -180 < angle <= 180  
    if (angle > 180)  
        angle -= 360;
    return angle; 
}

class Player {
  constructor(pos= POS_PLAYER_INIT){
    this.health = PLAYERHEALTH
    this.destroyed = false;
    this.bounced =false;
    loader.load("assets/player_ship/scene.gltf", (gltf) => {
      scene.add( gltf.scene )

      gltf.scene.scale.set(2,2,2)
      
      gltf.scene.position.set(pos[0], pos[1], pos[2])
      gltf.scene.rotation.y = Math.PI/2

      this.ship = gltf.scene
      this.vel = {
        speed: 0,
        rot: 0,
        bounce: 0
      }
    })
  }

  stop(){
    this.vel.speed = 0
    this.vel.rot = 0
  }

  update(){
    if(this.ship){
      if(this.bounced){
        if(this.health <=0){
          this.vel.bounce = -BOUNCE_VEL
          this.ship.position.y += this.vel.bounce*dt
          if(this.ship.position.y < -100){
            this.destroyed = true
            scene.remove(this.ship)
            abort()
          }
        }
        else{
          this.vel.bounce +=BOUNCE_ACC*dt
          this.ship.position.y += this.vel.bounce*dt
          if(this.ship.position.y > -0.5){
            this.bounced = false
            this.vel.bounce = 0
          }
        }
      }
      else{
        this.ship.rotation.y = primary(this.ship.rotation.y + this.vel.rot*dt);
        this.ship.translateX(this.vel.speed*dt)
      }
    }
  }
}

class Ship {
  constructor(pos= POS_PLAYER_INIT){
    this.cannonInterval = random(0, CANNON_INTERVAL);
    this.health = ENEMYHEALTH;
    this.destroyed = false;
    this.bounced = false;
    loader.load("assets/enemy_ship/scene.gltf", (gltf) => {
      scene.add( gltf.scene )
      
      gltf.scene.scale.set(2,2,2)
      gltf.scene.position.set(pos[0], pos[1], pos[2])
      // gltf.scene.rotation.y = Math.PI/2

      this.ship = gltf.scene
      this.vel = {
        speed: ENEMYSPEED,
        rot: ENEMYSPEED*0.003,
        bounce: 0
      }
    })
  }

  stop(){
    this.vel.speed = 0
    this.vel.rot = 0
  }

  update(){
    if(this.ship){
      if(this.bounced){
        if(this.health <=0){
          this.vel.bounce = -BOUNCE_VEL
          this.ship.position.y += this.vel.bounce*dt
          if(this.ship.position.y < -100){
            this.destroyed = true
            scene.remove(this.ship)
          }
        }
        else{
          this.vel.bounce +=BOUNCE_ACC*dt
          this.ship.position.y += this.vel.bounce*dt
          if(this.ship.position.y > -0.5){
            this.bounced = false
            this.vel.bounce = 0
          }
        }
      }
      else{
        this.ship.rotation.y = primary(this.ship.rotation.y + this.vel.rot*dt);
        this.ship.translateZ(this.vel.speed*dt)
      }
    }
  }
}

class Chest{
  constructor(pos){
    this.collected = false
    loader.load("assets/chest/scene.gltf", (gltf) => {
      scene.add( gltf.scene )
      gltf.scene.scale.set(0.04, 0.04, 0.04)
      gltf.scene.position.set(pos[0],pos[1],pos[2]);
      gltf.scene.rotation.y = random(-Math.PI, Math.PI);
      this.chest = gltf.scene
    })
  }
  update(){
    this.chest.translateX(CHESTSPEED* Math.sin(dt))
  }
}

class Cannon{
  constructor(pos = [0,0,0], vel, TYPE){
    this.alive = true;
    this.velocity = new THREE.Vector3(vel[0],vel[1],vel[2]);
    if (TYPE == 0){
      loader.load("assets/player_cannon/scene.gltf", (gltf) => {
        scene.add( gltf.scene )
        gltf.scene.scale.set(20,20,20);
        gltf.scene.position.set(pos[0],pos[1],pos[2])
        this.cannon = gltf.scene
      })
    }
    else{
      loader.load("assets/enemy_cannon/scene.gltf", (gltf) => {
        scene.add( gltf.scene )
        gltf.scene.scale.set(0.1,0.1,0.1);
        gltf.scene.position.set(pos[0],pos[1],pos[2])
        this.cannon = gltf.scene
      })
    }
  }
  update(){
    if(this.cannon){
      if(this.cannon.position.y < -10){
        this.alive= false;
        scene.remove(this.cannon);
      }
      this.velocity.y -= G*dt; 
      this.cannon.position.add(new THREE.Vector3(this.velocity.x*dt, this.velocity.y*dt, this.velocity.z*dt))
    }
  }
}

init();
function init() {
  // Scene
  renderer = new THREE.WebGLRenderer();
  renderer.setPixelRatio( window.devicePixelRatio );
  renderer.setSize( window.innerWidth, window.innerHeight );
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  document.body.appendChild( renderer.domElement );

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera( 55, window.innerWidth / window.innerHeight, 1, 20000 );
  camera.position.set(CAM_SIDETILT, CAM_HEIGHT, CAM_DIST);

  BEcamera = new THREE.PerspectiveCamera( 80, window.innerWidth / window.innerHeight, 1, 20000 );
  BEcamera.position.set(POS_PLAYER_INIT[0], BECAM_HEIGHT, POS_PLAYER_INIT[2]);

  sun = new THREE.Vector3();

  // Player ship
  player = new Player(POS_PLAYER_INIT)

  // Water
  const waterGeometry = new THREE.PlaneGeometry( 10000, 10000 );

  water = new Water(
    waterGeometry,
    {
      textureWidth: 512,
      textureHeight: 512,
      waterNormals: new THREE.TextureLoader().load( 'assets/waternormals.jpg', function ( texture ) {

        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;

      } ),
      sunDirection: new THREE.Vector3(),
      sunColor: 0xffffff,
      waterColor: 0x001e0f,
      distortionScale: 3.7,
      fog: scene.fog !== undefined
    }
  );

  water.rotation.x = - Math.PI / 2;

  scene.add( water );

  // Skybox
  const sky = new Sky();
  sky.scale.setScalar( 10000 );
  scene.add( sky );

  const skyUniforms = sky.material.uniforms;

  skyUniforms[ 'turbidity' ].value = 10;
  skyUniforms[ 'rayleigh' ].value = 2;
  skyUniforms[ 'mieCoefficient' ].value = 0.005;
  skyUniforms[ 'mieDirectionalG' ].value = 0.8;

  const parameters = {
    elevation: 5,
    azimuth: 180
  };

  const pmremGenerator = new THREE.PMREMGenerator( renderer );

  function updateSun() {

    const phi = THREE.MathUtils.degToRad( 90 - parameters.elevation );
    const theta = THREE.MathUtils.degToRad( parameters.azimuth );

    sun.setFromSphericalCoords( 1, phi, theta );

    sky.material.uniforms[ 'sunPosition' ].value.copy( sun );
    water.material.uniforms[ 'sunDirection' ].value.copy( sun ).normalize();

    scene.environment = pmremGenerator.fromScene( sky ).texture;

  }

  updateSun();

  //divs
  if (resultsElement) resultsElement.style.display = "none";
  if (hudElement) hudElement.style.display = "none";
  hudUpdate();
}

function restart(){
  resetValues();
  init();
}

function abort(){
  gameState =S.ENDED
  renderer.setAnimationLoop(null)
  if (resultsElement) resultsElement.style.display = "flex";
}

function onWindowResize() {

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize( window.innerWidth, window.innerHeight );

}

function isColliding(obj1, obj2){
  const b1 = new THREE.Box3().setFromObject(obj1);
  const b2 = new THREE.Box3().setFromObject(obj2);
  const s1 = 0.2 * Math.sqrt((b1.max.x - b1.min.x)**2 + (b1.max.y - b1.min.y)**2 + (b1.max.z - b1.min.z)**2) 
  const s2 = 0.2 * Math.sqrt((b2.max.x - b2.min.x)**2 + (b2.max.y - b2.min.y)**2 + (b2.max.z - b2.min.z)**2) 

  // return(
  //   ((b1.min.x < b2.max.x && b2.max.x < b1.max.x) || (b1.min.x < b2.min.x && b2.min.x < b1.max.x)) &&
  //   ((b1.min.y < b2.max.y && b2.max.y < b1.max.y) || (b1.min.y < b2.min.y && b2.min.y < b1.max.y)) &&
  //   ((b1.min.z < b2.max.z && b2.max.z < b1.max.z) || (b1.min.z < b2.min.z && b2.min.z < b1.max.z))
  // )
  return (
    Math.abs(obj1.position.x - obj2.position.x) < s1+s2 &&
    Math.abs(obj1.position.y - obj2.position.y) < s1+s2 &&
    Math.abs(obj1.position.z - obj2.position.z) < s1+s2 
  )
}

function dist(obj1,obj2){
  return (
    Math.sqrt((obj1.position.x - obj2.position.x)**2 +(obj1.position.z-obj2.position.z)**2)
  )
}

function ang(obj1,obj2){
  return(
    Math.atan((obj1.position.x - obj2.position.x)/(obj1.position.z - obj2.position.z))
  )
}

function checkCollisions(){
  
  // player - chest
  if(player.ship && !player.destroyed){
    for(let i=0; i<chests.length; i+=1){
      if(chests[i].chest && !chests[i].collected){
        if(isColliding(player.ship, chests[i].chest)){
          // // console.log("checking")
          scene.remove(chests[i].chest)
          chests[i].collected =true
          chestCurr -=1
          chests.splice(i,1)
          // hudUp("done")
          score+=10
          chests_collected+=1
          hudUpdate();
        }
      }
    }
  }

  // player_cannon - enemy
  Player_cannons.forEach(cannon=>{
    if(cannon.alive && cannon.cannon){
      for (var i=0;i< ships.length;i+=1){
        if (ships[i].ship && !ships[i].bounced){
          if (isColliding(ships[i].ship, cannon.cannon)){
            // console.log(ships[i].health)
            ships[i].health-=10
            ships[i].bounced = true
            ships[i].vel.bounce = -BOUNCE_VEL
            cannon.velocity.x = -cannon.velocity.x
            cannon.velocity.z = -cannon.velocity.z
          }
        }
      }
    }
  })

  // enemy_cannon - player
  Enemy_cannons.forEach(cannon=>{
    if(cannon.alive && cannon.cannon){
      if (player.ship && !player.bounced){
        if (isColliding(player.ship, cannon.cannon)){
          // console.log("happened")
          // console.log(player.health)
          player.health-=10
          health = player.health
          player.bounced = true
          player.vel.bounce = -BOUNCE_VEL
          cannon.velocity.x = -cannon.velocity.x
          cannon.velocity.z = -cannon.velocity.z
        }
      }
    }
  })

  // player - ship
  ships.forEach(ship=>{
    if(ship.ship && !ship.destroyed && player.ship && !player.destroyed){
      if(isColliding(player.ship, ship.ship)){
        ship.stop();
      }
    }
  })
}

function Chester(){
  if(chestCurr<CHEST_COUNT){
    const chest = new Chest([random(-window.innerWidth/3 + camera.position.x, window.innerWidth/3 + camera.position.x), -0.3, random(camera.position.z - window.innerWidth, camera.position.z + window.innerWidth)])
    chests.push(chest)
    chestCurr+=1;
  }
  chests.forEach(chest=>{
    if(chest.chest && !chest.collected)
    chest.update()
  })
}

function Shiper(){
  for(var i =0;i<ships.length;i+=1){
    if (ships[i].destroyed){
      ships.splice(i,1)
      shipCurr-=1
      score+=10
      ships_destroyed+=1
      hudUpdate();
    }
    else{
      ships[i].update()
    }
  }
  ships.forEach(ship => {
    if(ship.ship && !ship.bounced){
      ship.cannonInterval+=dt
      ship.vel.speed =ENEMYSPEED
      if (ship.ship.position.z < player.ship.position.z){
        if(ship.ship.rotation.y < ang(player.ship, ship.ship)){
          ship.vel.rot = +ENEMYSPEED*0.003;
        }
        else{
          ship.vel.rot = -ENEMYSPEED*0.003;
        }
      }
      else{
        let ff= dist(ship.ship, player.ship);
        if(ff<storage){
          if(ship.ship.position.x > player.ship.position.x){
            if(ship.ship.rotation.y + Math.PI < ang(player.ship,ship.ship)){
              ship.vel.rot = +ENEMYSPEED*0.003;
            }
            else{
              ship.vel.rot = -ENEMYSPEED*0.003;
            }
          }
          else{
            if(ship.ship.rotation.y - Math.PI < ang(player.ship,ship.ship)){
              ship.vel.rot = +ENEMYSPEED*0.003;
            }
            else{
              ship.vel.rot = -ENEMYSPEED*0.003;
            }
          }
        }
        storage =ff;
      }
    }
  })
  if(shipCurr<SHIP_COUNT){
    const ship = new Ship([random(-window.innerWidth/3 + camera.position.x, window.innerWidth/3 + camera.position.x), -0.5, random(camera.position.z - window.innerWidth, camera.position.z  - window.innerWidth/10)])
    ships.push(ship)
    shipCurr+=1;
  }  
}

function Cannons(){
  for(let i=0; i<Player_cannons.length; i+=1){
    Player_cannons[i].update();
    if (!Player_cannons[i].alive){
      Player_cannons.splice(i,1)
    }
  }

  for(let i=0; i<Enemy_cannons.length; i+=1){
    Enemy_cannons[i].update();
    if (!Enemy_cannons[i].alive){
      Enemy_cannons.splice(i,1)
    }
  }

  ships.forEach(ship=>{
    if (ship.ship && !ship.destroyed && ship.cannonInterval > CANNON_INTERVAL){
      ship.cannonInterval = 0
      let VEL = Math.sqrt((G* dist(player.ship, ship.ship))/2)
      VEL = VEL < VEL_MAX ? VEL:VEL_MAX 
      const ANGLE = Math.atan((player.ship.position.x-ship.ship.position.x)/(player.ship.position.z-ship.ship.position.z))
      const cannon = new Cannon(
        [ship.ship.position.x, ship.ship.position.y, ship.ship.position.z],
        [VEL*Math.sin(ANGLE)*(ship.ship.position.z < player.ship.position.z?1:-1), VEL, VEL*Math.cos(ANGLE)*(ship.ship.position.z < player.ship.position.z?1:-1)],
        1
      )
      Enemy_cannons.push(cannon)
    }
  })
}

function animate(timestep) {
 // dt = timestep - lastTimeStep;
  if (Math.floor(Date.now()/1000 - startTime) > 1){
    startTime+=1
    time_lapsed+=1
    hudUpdate();
  }

  render();

  player.update()

  //camera.position.set(CAM_SIDETILT, CAM_HEIGHT, CAM_DIST);
  if(!player.bounced){
    camera.position.set(-CAM_DIST * Math.cos(-player.ship.rotation.y)+CAM_SIDETILT*Math.sin(-player.ship.rotation.y), CAM_HEIGHT, -CAM_DIST * Math.sin(-player.ship.rotation.y)-CAM_SIDETILT*Math.cos(-player.ship.rotation.y));
    camera.position.add(player.ship.position);
    camera.lookAt(player.ship.position.x, camera.position.y, player.ship.position.z)
  }

  //BEcamera
  BEcamera.position.set(0.9* (CAM_DIST * Math.cos(-player.ship.rotation.y)-CAM_SIDETILT*Math.sin(-player.ship.rotation.y)), BECAM_HEIGHT, 0.9*(CAM_DIST * Math.sin(-player.ship.rotation.y)+CAM_SIDETILT*Math.cos(-player.ship.rotation.y)));
  BEcamera.position.add(camera.position);
  BEcamera.lookAt(player.ship.position.x, camera.position.y, player.ship.position.z)
  
  checkCollisions()
  //Objects
  Chester();
  Shiper();
  Cannons();
  
  lastTimeStep = timestep;
}

function render() {
  water.material.uniforms[ 'time' ].value += 1.0 / 60.0;  
  renderer.render( scene, camType ? BEcamera : camera );
}

eventHandler()
function eventHandler(){

  window.addEventListener('click',()=>{
    // console.log(gameState)
    if (gameState == S.START || gameState == S.PAUSED){
      //resume
      renderer.setAnimationLoop(animate)
      gameState= S.ON
      if (hudElement) hudElement.style.display = "flex";
      if (instructionsElement) instructionsElement.style.display = "none";
      startTime = Math.round(Date.now()/1000);
    }
    else if (gameState == S.ON){
      //shoot
      let min_d = 999999
      var d
      ships.forEach(ship=>{
        d = dist(ship.ship,player.ship)
        if (d<min_d)
          min_d = d 
      })
      let VEL = Math.sqrt((G* min_d)/2)
      VEL = VEL < VEL_MAX ? VEL:VEL_MAX 
      const cannon = new Cannon(
        [player.ship.position.x, player.ship.position.y, player.ship.position.z],
        [VEL* Math.cos(player.ship.rotation.y), VEL, -VEL * Math.sin(player.ship.rotation.y)],
        0);
      Player_cannons.push(cannon)
    }
    else{
      //restart
      restart()
    }
  })
  window.addEventListener( 'resize', onWindowResize );

  window.addEventListener( 'keydown', function(e){
    // camera
    if(gameState != S.START && e.key.toLowerCase() == "c"){
      console.log("cc")
      if (camType == 0) camType = 1
      else camType =0
      console.log(camType)
      console.log(BEcamera.position)
    }
    // game pause
    if(e.key.toLowerCase() == "p"){
      if (gameState == S.PAUSED){
        renderer.setAnimationLoop(animate)
        gameState= S.ON
        startTime = Math.round(Date.now()/1000);
        if (hudElement) hudElement.style.display = "default";
        if (instructionsElement) instructionsElement.style.display = "none";
      }
      else if (gameState == S.ON){
        renderer.setAnimationLoop(null)
        gameState= S.PAUSED
        if (instructionsElement) instructionsElement.style.display = "flex";
      }
    }

    // game restart
    if(e.key.toLowerCase() == "r"){
      restart()
    }


    if (gameState ==S.ON && player.ship && !player.destroyed){
      if(e.key.toLowerCase() == "w"){
        player.vel.speed = PLAYERSPEED
      }
      if(e.key.toLowerCase() == "s"){
        player.vel.speed = -PLAYERSPEED
      }
      if(e.key.toLowerCase() == "d"){
        player.vel.rot = -PLAYERSPEED*0.03
      }
      if(e.key.toLowerCase() == "a"){
        player.vel.rot = PLAYERSPEED*0.03
      }
    }
  })
  window.addEventListener( 'keyup', function(){
    if (player.ship && !player.destroyed){
      player.stop()
    }
  })
}
