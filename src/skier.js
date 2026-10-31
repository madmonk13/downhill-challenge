// Smooth penguin on skis, with poles, goggles, a bobble hat and a trailing scarf.
// The model faces +Z with +Y up; its origin sits where the skis touch the snow.

import * as THREE from 'three';

function sphere(r, material, ws = 8, hs = 6) {
  return new THREE.Mesh(new THREE.SphereGeometry(r, ws, hs), material);
}

export function buildSkier() {
  const group = new THREE.Group();
  // smooth-shaded so the penguin reads soft against the faceted world
  const smooth = (color, shininess = 12) => new THREE.MeshPhongMaterial({ color, shininess, specular: 0x222222 });
  const black = smooth(0x23262e, 30);
  const white = smooth(0xf7f7f2, 6);
  const orange = smooth(0xff9a2e, 20);
  const red = smooth(0xe84a3a, 4);
  const skiMat = smooth(0x2f7fd4, 60);
  const metal = smooth(0xc4ccd6, 60);
  const dark = smooth(0x1d2533, 10);
  const S = 28; // sphere segments

  // ---- skis: each on its own pivot under a boot so they can splay and tip onto an edge ----
  const skis = [];
  for (const side of [-1, 1]) {
    const ski = new THREE.Group();
    ski.position.x = side * 0.17;
    const plank = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.035, 1.75), skiMat);
    plank.position.set(0, 0.018, -0.05);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.035, 0.26), skiMat);
    tip.position.set(0, 0.06, 0.88);
    tip.rotation.x = -0.45;
    const binding = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.06, 0.3), dark);
    binding.position.set(0, 0.06, -0.08);
    ski.add(plank, tip, binding);
    ski.userData.side = side;
    group.add(ski);
    skis.push(ski);
  }

  // ---- penguin: pivots at the boots, so leaning and tucking fold the whole body ----
  const rider = new THREE.Group();
  rider.position.y = 0.08;
  group.add(rider);
  const legs = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.16, 6, 12), black);
    leg.position.set(side * 0.16, 0.14, -0.06);
    const foot = sphere(0.12, orange, 16, 10);
    foot.scale.set(0.8, 0.3, 1.25);
    foot.position.set(side * 0.17, 0.0, 0.0);
    rider.add(leg, foot);
    legs.push(leg);
  }

  const penguin = new THREE.Group();
  penguin.position.y = 0.22; // standing on its stubby legs
  rider.add(penguin);

  const torso = sphere(0.42, black, S, S * 0.75);
  torso.scale.set(1, 1.25, 0.95);
  torso.position.y = 0.5;
  const belly = sphere(0.36, white, S, S * 0.75);
  belly.scale.set(0.85, 1.1, 0.6);
  belly.position.set(0, 0.45, 0.25);
  const head = sphere(0.3, black, S, S * 0.75);
  head.position.y = 1.08;
  const face = sphere(0.21, white, S, S * 0.75);
  face.scale.set(1, 0.9, 0.6);
  face.position.set(0, 1.07, 0.2);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.2, 16), orange);
  beak.scale.set(1, 0.7, 1);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 1.0, 0.36);
  penguin.add(torso, belly, head, face, beak);

  // goggles: a strap round the head and two tinted lenses over the eyes
  const strap = new THREE.Mesh(new THREE.TorusGeometry(0.305, 0.03, 8, 32), dark);
  strap.rotation.x = Math.PI / 2 - 0.12;
  strap.position.y = 1.13;
  penguin.add(strap);
  const lensMat = new THREE.MeshPhongMaterial({ color: 0xffa726, shininess: 120, specular: 0xffffff, emissive: 0x4a2200 });
  for (const side of [-1, 1]) {
    const lens = sphere(0.085, lensMat, 16, 12);
    lens.scale.set(1, 0.75, 0.45);
    lens.position.set(side * 0.1, 1.14, 0.29);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.018, 6, 20), dark);
    rim.scale.set(1, 0.75, 1);
    rim.position.set(side * 0.1, 1.14, 0.3);
    rim.rotation.y = side * 0.25;
    lens.rotation.y = side * 0.25;
    penguin.add(lens, rim);
  }

  // bobble hat
  const hat = new THREE.Mesh(new THREE.SphereGeometry(0.315, S, S / 2, 0, Math.PI * 2, 0, Math.PI * 0.42), red);
  hat.position.y = 1.12;
  hat.rotation.x = -0.15;
  const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.255, 0.05, 8, 28), white);
  cuff.rotation.x = Math.PI / 2 - 0.15;
  cuff.position.set(0, 1.21, -0.01);
  const bobble = sphere(0.09, white, 14, 10);
  bobble.position.set(0, 1.44, -0.05);
  penguin.add(hat, cuff, bobble);

  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.065, 12, 28), red);
  scarf.rotation.x = Math.PI / 2;
  scarf.position.y = 0.84;
  const scarfTail = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.32, 6, 12), red);
  scarfTail.geometry.rotateX(Math.PI / 2).translate(0, 0, -0.2);
  scarfTail.scale.set(1, 0.4, 1);
  scarfTail.position.set(0.12, 0.84, -0.22);
  penguin.add(scarf, scarfTail);

  // flippers, each holding a pole that reaches down past the boots
  const flippers = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.38, 0.75, 0);
    const flipper = sphere(0.25, black, 20, 14);
    flipper.scale.set(0.18, 1, 0.48);
    flipper.position.y = -0.2;
    pivot.add(flipper);
    const pole = new THREE.Group();
    pole.position.set(0, -0.36, 0.06); // in the flipper tip
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.014, 1.15, 6).translate(0, -0.5, 0), metal);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.16, 8), dark);
    const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.015, 10), dark);
    basket.position.y = -0.98;
    pole.add(shaft, grip, basket);
    pivot.add(pole);
    pivot.userData = { side, pole };
    penguin.add(pivot);
    flippers.push(pivot);
  }

  group.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });

  let time = 0;
  let tuck = 0; // 0 standing .. 1 full tuck
  let spin = 0;
  const lerp = (from, to, rate, dt) => from + (to - from) * Math.min(1, dt * rate);

  // info: { steer, airborne, tucked, crashed, speed }
  function animate(dt, info) {
    time += dt;
    tuck = lerp(tuck, info.tucked ? 1 : 0, 9, dt);

    // lean into the turn (the whole body tips over the edges) and fold forward in a tuck;
    // after a crash, flop over onto one side once back on the snow
    const lean = info.crashed && !info.airborne ? 1.45 : info.steer * 0.4;
    rider.rotation.z = lerp(rider.rotation.z, lean, info.crashed ? 6 : 8, dt);
    penguin.rotation.x = 0.12 + tuck * 0.55;
    penguin.position.y = 0.22 - tuck * 0.12;
    for (const leg of legs) {
      leg.scale.y = 1 - tuck * 0.45;
      leg.position.y = 0.14 - tuck * 0.04;
    }

    // skis: a slight steer and tipped onto their edges in a turn, tips up a touch in the air
    for (const ski of skis) {
      ski.rotation.y = lerp(ski.rotation.y, -info.steer * 0.12, 10, dt);
      ski.rotation.z = rider.rotation.z * 0.5;
      ski.rotation.x = lerp(ski.rotation.x, info.airborne && !info.crashed ? -0.12 : 0, 6, dt);
    }

    // flippers: poles planted alongside when standing, tucked back under the arms in a tuck,
    // and flung out wide for balance in the air
    for (const f of flippers) {
      const side = f.userData.side;
      const out = info.airborne ? 1.0 : 0.25 - tuck * 0.15;
      f.rotation.z = lerp(f.rotation.z, side * out, 10, dt);
      const swing = info.airborne ? -0.3 : -0.25 - tuck * 0.9;
      f.rotation.x = lerp(f.rotation.x, swing, 10, dt);
      f.userData.pole.rotation.x = lerp(f.userData.pole.rotation.x, 0.35 + tuck * 0.6, 10, dt);
    }

    scarfTail.rotation.y = Math.sin(time * 9) * 0.25 * Math.min(1, info.speed / 15);
    scarfTail.rotation.x = 0.4 - Math.min(0.45, info.speed / 40);

    // crashed and falling: tumble head over heels
    if (info.crashed && info.airborne) spin += dt * 7;
    rider.rotation.x = info.crashed ? spin : 0;
  }

  function reset() {
    tuck = spin = 0;
    rider.rotation.set(0, 0, 0);
  }

  return { group, animate, reset };
}
