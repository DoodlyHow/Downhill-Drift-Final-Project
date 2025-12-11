const START_TIME = 20;
let timer = START_TIME;

// sound + airborne
let trickSound;
let isAirborne = false;

// images
let hillImg;
let wallImg;
let dayBgImg;
let nightBgImg;
let helmetImg;
let skateImg;

// tokens
let helmetTokens;
let helmetSound;

// terrain data
let rawPts = [];
let baseSmooth = [];
let hillSprites = [];
// player
let player = null;

// world
let WORLD_HEIGHT;

const VIEW_WIDTH = 1500;
const VIEW_HEIGHT = 500;

const MAP_SCALE = 4;
const SMOOTH_STEP = 2;
const COLLIDER_THICK = 10;

const GAP = 150;

const CANVAS_SCALE = 0.75;

const VISUAL_SCALE = 1.6;

let isGameOver = false;

// START SCREEN
let gameStarted = false;
let showingControls = false;

// INFINITE TERRAIN
const NUM_SEGMENTS = 2;
let segments = [];

function preload() {
  hillImg = loadImage("longHillmapupdated.png");
  wallImg = loadImage("Brick wall.jpg");
  skateImg = loadImage("skatebaord.png");
  dayBgImg = loadImage("Daytimebackground.png");
  nightBgImg = loadImage("Nighttimebackground.png");
  helmetImg = loadImage("bikerHelmetTokenUpdate.png");
  // sounds below
  helmetSound = loadSound("plastic_helmet.mp3");
  trickSound = loadSound("skateboardTrick.mp3");
}

function setup() {
  new Canvas(VIEW_WIDTH, VIEW_HEIGHT);
  world.gravity.y = 10;

  // token group
  helmetTokens = new Group();
  helmetTokens.collider = "static";
  helmetTokens.visible = true;

  buildTerrainFromImage();
  resetTerrainAndTokens(false);
}

// Build ONE hill shape -> baseSmooth
function buildTerrainFromImage() {
  rawPts = [];
  baseSmooth = [];

  hillImg.loadPixels();

  const imgW = hillImg.width;
  const imgH = hillImg.height;

  for (let x = 0; x < imgW; x += SMOOTH_STEP) {
    for (let y = 0; y < imgH; y++) {
      const idx = 4 * (y * imgW + x);
      const a = hillImg.pixels[idx + 3];
      if (a > 10) {
        rawPts.push({ x: x * MAP_SCALE, y: y * MAP_SCALE });
        break;
      }
    }
  }

  baseSmooth = smoothCurve(rawPts, 4);
  WORLD_HEIGHT = hillImg.height * MAP_SCALE;
}

function resetTerrainAndTokens(spawnTokens = true) {
  initInfiniteTerrain();

  if (helmetTokens) {
    helmetTokens.removeAll();
    if (spawnTokens) {
      spawnHelmetTokensForAllSegments();
    }
  }
}

function initInfiniteTerrain() {
  // clear old colliders
  for (let h of hillSprites) h.remove();
  hillSprites = [];

  const hillWorldWidth = hillImg.width * MAP_SCALE;
  const segmentWidth = hillWorldWidth + GAP;

  segments = [];
  for (let i = 0; i < NUM_SEGMENTS; i++) {
    const seg = {
      xOffset: i * segmentWidth,
      colliders: [],
    };
    segments.push(seg);
    rebuildSegmentColliders(seg);
  }
}

// build colliders for ONE segment
function rebuildSegmentColliders(seg) {
  // remove old
  if (seg.colliders) {
    for (let c of seg.colliders) {
      // also remove from hillSprites array
      const idx = hillSprites.indexOf(c);
      if (idx !== -1) hillSprites.splice(idx, 1);
      c.remove();
    }
  }
  seg.colliders = [];

  const hillWorldWidth = hillImg.width * MAP_SCALE;
  const offsetX = seg.xOffset;

  for (let i = 0; i < baseSmooth.length - 1; i++) {
    const p1 = baseSmooth[i];
    const p2 = baseSmooth[i + 1];

    const x1 = p1.x + offsetX;
    const y1 = p1.y;
    const x2 = p2.x + offsetX;
    const y2 = p2.y;

    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const len = dist(x1, y1, x2, y2);
    const ang = atan2(y2 - y1, x2 - x1);
    const nx = -sin(ang);
    const ny = cos(ang);

    let segSprite = new Sprite(midX, midY, len + 2, COLLIDER_THICK, "static");
    segSprite.rotation = ang;
    segSprite.pos.x -= nx * (COLLIDER_THICK / 2);
    segSprite.pos.y -= ny * (COLLIDER_THICK / 2);
    segSprite.friction = 0.1;
    segSprite.bounciness = 0;

    segSprite.visible = false; //use to test colision to see why it wont spawn in

    hillSprites.push(segSprite);
    seg.colliders.push(segSprite);
  }
}

//// Create and Restart ////
function startGame() {
  if (player) {
    player.remove();
    player = null;
  }

  resetTerrainAndTokens(true);

  const startX = 150;
  const hillY = hillYAtX(startX);

  const boardW = 40;
  const boardH = 20;
  const SPAWN_Y_OFFSET = -60;

  player = new Sprite(
    startX,
    hillY - boardH / 2 + SPAWN_Y_OFFSET,
    boardW,
    boardH
  );
  player.rotationLock = false;
  player.friction = 0.05;
  player.bounciness = 0.0;
  player.linearDamping = 0.1;

  // bigger visual board, collider unchanged
  player.draw = function () {
    push();
    imageMode(CENTER);
    const yOffset = 10;
    const drawW = boardW * VISUAL_SCALE;
    const drawH = boardH * VISUAL_SCALE;
    image(skateImg, 0, yOffset, drawW, drawH);
    pop();
  };

  timer = START_TIME;
  isGameOver = false;
  gameStarted = true;

  isAirborne = false;
  if (trickSound.isPlaying()) trickSound.stop();
}

function backToTitle() {
  if (player) {
    player.remove();
    player = null;
  }
  if (helmetTokens) {
    helmetTokens.removeAll();
  }
  isGameOver = false;
  gameStarted = false;
  showingControls = false;
  timer = START_TIME;

  isAirborne = false;
  if (trickSound.isPlaying()) trickSound.stop();
}

function draw() {
  background(255);
  
 

  ////// TITLE SCREEN ///////////
  if (!gameStarted) {
    drawStartScreen();
    return;
  }

  // GAME CAMERA
  camera.on();
  camera.x = player.x + 500;
  camera.y = VIEW_HEIGHT / 2;

  const hillWorldWidth = hillImg.width * MAP_SCALE;
  const hillWorldHeight = hillImg.height * MAP_SCALE;
  const segmentWidth = hillWorldWidth + GAP;

  // DAY/NIGHT based on player.x
  const cycleLength = segmentWidth * 6;
  let cx = player.x % cycleLength;
  if (cx < 0) cx += cycleLength;
  let t = cx / cycleLength;

  let nightAmount;
  if (t < 0.5) {
    nightAmount = map(t, 0.0, 0.5, 0.0, 1.0);
  } else {
    nightAmount = map(t, 0.5, 1.0, 1.0, 0.0);
  }
  nightAmount = constrain(nightAmount, 0, 1);
  let dayAmount = 1 - nightAmount;

  // draw background & hills per ACTIVE segment
  for (let seg of segments) {
    const xOff = seg.xOffset;

    if (dayBgImg && nightBgImg) {
      tint(255, dayAmount * 255);
      image(dayBgImg, xOff, 0, segmentWidth, VIEW_HEIGHT);

      tint(255, nightAmount * 255);
      image(nightBgImg, xOff, 0, segmentWidth, VIEW_HEIGHT);

      noTint();
    }

    image(hillImg, xOff, 0, hillWorldWidth, hillWorldHeight);
    // gap between segments is left empty -> you can jump/fall there
  }

  camera.off();

  // limiting the board rotation so it can't go fully sideways
  if (player) {
     //console.log(player.x)
    player.rotation = constrain(player.rotation, -30, 30);
  }

  // GAMEPLAY
  if (!isGameOver) {
    const SPEED = 9;

    if (kb.pressing("left")) player.vel.x = -SPEED;
    else if (kb.pressing("right")) player.vel.x = SPEED;

    if (kb.pressing("space")) player.vel.y++;

    // ---- AIRBORNE DETECTION + SOUND ----
    let onGround = false;
    for (let h of hillSprites) {
      if (player.colliding(h)) {
        onGround = true;
        break;
      }
    }

    // just left ground
    if (!onGround && !isAirborne) {
      isAirborne = true;
      if (!trickSound.isPlaying()) {
        trickSound.play();
      }
    }

    // just landed
    if (onGround && isAirborne) {
      isAirborne = false;
      trickSound.stop();
    }

    // collect helmet tokens (+3 seconds)
    player.overlaps(helmetTokens, (p, token) => {
      timer += 3;

      if (helmetSound && !helmetSound.isPlaying()) {
        helmetSound.play();
      }

      token.remove();
    });

    // countdown timer
    if (frameCount % 60 === 0 && timer > 0) {
      timer--;
    }

    // falling off map = game over
    if (player.y > WORLD_HEIGHT + 600) {
      isGameOver = true;
    }

    // timer out = game over
    if (timer <= 0) {
      timer = 0;
      isGameOver = true;
    }

    // update infinite terrain (recycle segments ahead)
    updateInfiniteTerrain();

    keepWorldCentered();
  }

  //////// UI ///////////
  fill(0);
  textSize(30);
  textAlign(CENTER, TOP);
  text("Timer: " + max(timer, 0), width / 2, 20);

  if (isGameOver) {
    drawGameOverScreen();
  }
}

/////// INFINITE TERRAIN //////////
function updateInfiniteTerrain() {
  const hillWorldWidth = hillImg.width * MAP_SCALE;
  const segmentWidth = hillWorldWidth + GAP;
  const RECYCLE_MARGIN = 300;

  for (let seg of segments) {
    if (player.x > seg.xOffset + segmentWidth + RECYCLE_MARGIN) {
      // store old range for token cleanup
      const oldOffset = seg.xOffset;

      // find furthest segment
      let maxOffset = segments[0].xOffset;
      for (let s of segments) {
        if (s.xOffset > maxOffset) maxOffset = s.xOffset;
      }

      // move this segment ahead
      seg.xOffset = maxOffset + segmentWidth;

      // rebuild colliders for this moved segment
      rebuildSegmentColliders(seg);

      // remove old tokens from that region
      const minX = oldOffset - 50;
      const maxX = oldOffset + segmentWidth + 50;
      for (let token of helmetTokens) {
        if (token.x >= minX && token.x <= maxX) {
          token.remove();
        }
      }

      // spawn fresh helmets in the new segment
      spawnHelmetTokensForSegment(seg);
    }
  }
}

// hillYAtX for infinite repeating terrain
function hillYAtX(x) {
  if (baseSmooth.length === 0) return WORLD_HEIGHT;

  const hillWorldWidth = hillImg.width * MAP_SCALE;
  const segmentWidth = hillWorldWidth + GAP;

  // wrap into local repeat
  let localX = x % segmentWidth;
  if (localX < 0) localX += segmentWidth;

  // if we're in the GAP (no hill)
  if (localX >= hillWorldWidth) {
    return WORLD_HEIGHT + 200; // below visible hill
  }

  // now use baseSmooth (0..hillWorldWidth)
  if (localX <= baseSmooth[0].x) return baseSmooth[0].y;
  if (localX >= baseSmooth[baseSmooth.length - 1].x)
    return baseSmooth[baseSmooth.length - 1].y;

  for (let i = 0; i < baseSmooth.length - 1; i++) {
    const p1 = baseSmooth[i];
    const p2 = baseSmooth[i + 1];
    if (localX >= p1.x && localX <= p2.x) {
      const t = (localX - p1.x) / (p2.x - p1.x);
      return lerp(p1.y, p2.y, t);
    }
  }

  return baseSmooth[baseSmooth.length - 1].y;
}

///////// HELMETS //////////
function spawnHelmetTokensForSegment(seg) {
  const hillWorldWidth = hillImg.width * MAP_SCALE;
  const segmentWidth = hillWorldWidth + GAP;

  const NUM_TOKENS_PER_SEG = 3;
  const margin = 200;

  for (let i = 0; i < NUM_TOKENS_PER_SEG; i++) {
    const localX = random(margin, hillWorldWidth - margin); // only on hill, not gap
    const worldX = seg.xOffset + localX;
    const y = hillYAtX(worldX) - 40;

    let token = new helmetTokens.Sprite(worldX, y, 30, 30);
    token.img = helmetImg;
    token.scale = 0.6;
    token.rotationLock = true;
  }
}

function spawnHelmetTokensForAllSegments() {
  for (let seg of segments) {
    spawnHelmetTokensForSegment(seg);
  }
}

/////////// UI SCREENS ///////////////
function drawStartScreen() {
  if (wallImg) {
    image(wallImg, 0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  } else {
    background(50, 120, 200);
  }

  noStroke();
  fill(0, 120);
  rectMode(CORNER);
  rect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

  fill(255);
  textAlign(CENTER, CENTER);
  textSize(60);
  text("Downhill Drift", VIEW_WIDTH / 2, VIEW_HEIGHT * 0.25);

  fill(255);
  textAlign(CENTER, CENTER);
  textSize(23);
  text("by Noah Gardenier", VIEW_WIDTH / 2, VIEW_HEIGHT * 0.35);

  textSize(32);
  text("Press ENTER to Start", VIEW_WIDTH / 2, VIEW_HEIGHT * 0.55);

  rectMode(CENTER);
  fill(255);
  rect(VIEW_WIDTH / 2, VIEW_HEIGHT * 0.7, 250, 60);

  fill(0);
  textSize(28);
  text("CONTROLS", VIEW_WIDTH / 2, VIEW_HEIGHT * 0.7);

  if (showingControls) drawControlsPopup();
}

function drawControlsPopup() {
  fill(255);
  rectMode(CENTER);
  rect(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, 600, 330);

  fill(0);
  textAlign(CENTER, CENTER);
  textSize(30);
  text("How To Play", VIEW_WIDTH / 2, VIEW_HEIGHT / 2 - 120);

  textSize(22);
  text(
    "← →  Move Left/Right\nSPACE to Push Down\nFall into a gap or run out of time = Game Over\n\nPress ENTER to Start",
    VIEW_WIDTH / 2,
    VIEW_HEIGHT / 2 - 20
  );

  fill(230);
  rect(VIEW_WIDTH / 2, VIEW_HEIGHT / 2 + 110, 200, 50);

  fill(0);
  textSize(24);
  text("CLOSE", VIEW_WIDTH / 2, VIEW_HEIGHT / 2 + 110);
}

function drawGameOverScreen() {
  push();
  noStroke();

  // full-screen dark overlay
  fill(0, 150);
  rectMode(CORNER);
  rect(0, 0, width, height);

  // size of the game over panel
  const panelW = 600;
  const panelH = 300;

  // ---- brick wall panel instead of white box ----
  if (wallImg) {
    imageMode(CENTER);
    image(wallImg, width / 2, height / 2, panelW, panelH);

    // darken it a bit so text is readable
    fill(0, 120);
    rectMode(CENTER);
    rect(width / 2, height / 2, panelW, panelH);
  } else {
    // fallback: plain box if image not loaded
    fill(255);
    rectMode(CENTER);
    rect(width / 2, height / 2, panelW, panelH);
  }

  fill(255);
  textAlign(CENTER, CENTER);

  textSize(40);
  text("GAME OVER", width / 2, height / 2 - 80);

  textSize(24);
  text("You ran out of time or fell into a gap.", width / 2, height / 2 - 20);

  textSize(22);
  text(
    "Press R to Restart\nPress T to return to Title",
    width / 2,
    height / 2 + 50
  );

  pop();
}

////////////// INPUT /////////////////
function mousePressed() {
  if (!gameStarted) {
    const mx = mouseX / CANVAS_SCALE;
    const my = mouseY / CANVAS_SCALE;

    const bx = VIEW_WIDTH / 2;
    const by = VIEW_HEIGHT * 0.7;

    // CONTROLS button
    if (
      !showingControls &&
      mx > bx - 125 &&
      mx < bx + 125 &&
      my > by - 30 &&
      my < by + 30
    ) {
      showingControls = true;
      return;
    }

    // CLOSE button inside controls popup
    if (showingControls) {
      const cx = VIEW_WIDTH / 2;
      const cy = VIEW_HEIGHT / 2 + 110;

      if (mx > cx - 100 && mx < cx + 100 && my > cy - 25 && my < cy + 25) {
        showingControls = false;
      }
    }
  }
}

function keyPressed() {
  if (!gameStarted) {
    if (key === "c" || key === "C") {
      showingControls = true;
      return;
    }

    if (showingControls && keyCode === ESCAPE) {
      showingControls = false;
      return;
    }

    if (keyCode === ENTER) {
      showingControls = false;
      startGame();
      return;
    }
  } else if (isGameOver) {
    if (key === "r" || key === "R") {
      startGame();
      return;
    }
    if (key === "t" || key === "T") {
      backToTitle();
      return;
    }
  }
}

/////////  HELPERS ///////////////
function isHillPixel(r, g, b, a) {
  return a > 10; // any non-transparent pixel = hill
}

function smoothCurve(pts, iterations = 3) {
  if (pts.length <= 2) return pts.slice();
  let res = pts.map((p) => ({ x: p.x, y: p.y }));
  for (let k = 0; k < iterations; k++) {
    let tmp = [];
    for (let i = 0; i < res.length; i++) {
      if (i === 0 || i === res.length - 1) tmp.push({ ...res[i] });
      else {
        let sumY = res[i].y,
          count = 1;
        if (i > 0) {
          sumY += res[i - 1].y;
          count++;
        }
        if (i < res.length - 1) {
          sumY += res[i + 1].y;
          count++;
        }
        if (i > 1) {
          sumY += res[i - 2].y;
          count++;
        }
        if (i < res.length - 2) {
          sumY += res[i + 2].y;
          count++;
        }
        tmp.push({ x: res[i].x, y: sumY / count });
      }
    }
    res = tmp;
  }
  return res;
}

function keepWorldCentered() {
  if (!player) return;

  const hillWorldWidth = hillImg.width * MAP_SCALE;
  const segmentWidth = hillWorldWidth + GAP;

  const WRAP_AT = segmentWidth * 3; // how far right the player can go before we shift the world

  if (player.x > WRAP_AT) {
    const shift = segmentWidth;

    // move player
    player.x -= shift;

    // move all segments and their colliders
    for (let seg of segments) {
      seg.xOffset -= shift;
      if (seg.colliders) {
        for (let c of seg.colliders) {
          c.x -= shift;
        }
      }
    }

    // move all helmet tokens
    for (let token of helmetTokens) {
      token.x -= shift;
    }
  }
}
