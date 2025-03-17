// src/entities/Zombie.js
import { Vector3, AnimationMixer, Clock, Euler, LoopOnce, LoopRepeat, SkeletonHelper, 
    Box3, BoxGeometry, MeshStandardMaterial, Mesh, Color } from 'three';
import { PhysicsBody } from '../physics/PhysicsBody.js';

export class Zombie {
constructor(engine, position = new Vector3(0, 0, 0)) {
   this.engine = engine;
   this.type = 'zombie';
   this.id = null; // Will be assigned by EntityManager
   this.position = position.clone();
   this.rotation = new Euler(0, 0, 0);
   this.enabled = true;
   
   // Zombie state
   this.state = 'idle'; // idle, chase, attack, death
   this.health = 100;
   this.speed = {
       walk: 2.0,
       run: 4.5,
       crawl: 1.0
   };
   this.damage = 20;
   this.attackRange = 1.8;
   this.detectionRange = 15;
   this.attackCooldown = 1.2; // seconds
   this.lastAttackTime = 0;
   this.timeSinceLastStateChange = 0;
   this.targetPosition = null;
   this.isAlive = true;
   
   // Physics
   this.physicsBody = new PhysicsBody({
       position: this.position.clone(),
       mass: 70,
       radius: 0.5,
       restitution: 0.2,
       friction: 0.5
   });
   
   // Animation properties
   this.object = null; // 3D model object
   this.mixer = null; // Animation mixer
   this.animations = {}; // Animation clips
   this.currentAnimation = null;
   this.animationClock = new Clock();
   this.skeletonHelper = null; // Debug helper for skeleton
   this.debugMesh = null; // Fallback visual representation
}

async init(engine) {
   // Add physics body to world
   this.engine.physics.addBody(this.physicsBody);
   
   // Load zombie model and animations
   await this.loadModel();
   
   // Start in idle state
   this.changeState('idle');
   
   return this; // Return self for chaining
}

async loadModel() {
   try {
       // Get the zombie model (already loaded by ZombieAssetLoader)
       const zombieModel = this.engine.assetManager.getModel('zombie');
       
       if (!zombieModel) {
           console.error("Zombie model not loaded or not found!");
           this.createDebugMesh(); // Create a placeholder if model isn't found
           return;
       }
       
       // Clone the FBX model properly
       this.object = zombieModel.clone();
       
       // CRITICAL: Set the proper scale for the zombie - FBX models are typically very large
       this.object.scale.set(0.01, 0.01, 0.01);
       
       // Position at physics body location
       this.object.position.copy(this.position);
       
       // Flag to check if any visible meshes were found
       let hasVisibleMeshes = false;
       
       // Process all child meshes to ensure they're visible
       this.object.traverse(node => {
           if (node.isMesh) {
               node.castShadow = true;
               node.receiveShadow = true;
               
               if (node.material) {
                   // Fix material properties
                   if (Array.isArray(node.material)) {
                       node.material.forEach(mat => {
                           mat.transparent = false;
                           mat.opacity = 1.0;
                           mat.visible = true;
                           mat.needsUpdate = true;
                       });
                   } else {
                       node.material.transparent = false;
                       node.material.opacity = 1.0;
                       node.material.visible = true;
                       node.material.needsUpdate = true;
                   }
                   
                   hasVisibleMeshes = true;
               }
           }
       });
       
       // If no visible mesh was found, create a debug mesh
       if (!hasVisibleMeshes) {
           this.createDebugMesh();
       }
       
       // Create animation mixer for this instance
       this.mixer = new AnimationMixer(this.object);
       
       // Map animation IDs to internal names
       const animationMap = {
           'zombie_idle': 'idle',
           'zombie_walk': 'walk',
           'zombie_run': 'run',
           'zombie_attack': 'attack',
           'zombie_death': 'death'
       };
       
       // Get animations from asset manager and store them
       for (const [animId, animName] of Object.entries(animationMap)) {
           const anim = this.engine.assetManager.getAnimation(animId);
           if (anim) {
               // Store the animation
               this.animations[animName] = anim;
               console.log(`Animation ${animName} loaded for zombie`);
           } else {
               console.warn(`Animation ${animId} not found in asset manager`);
           }
       }
       
       // Add skeleton helper for debugging if debug is enabled
       if (this.engine.config.debug) {
           this.skeletonHelper = new SkeletonHelper(this.object);
           this.engine.renderer.scene.add(this.skeletonHelper);
       }
       
       // Add to scene
       this.engine.renderer.scene.add(this.object);
       
       console.log("Zombie model loaded successfully");
       
   } catch (error) {
       console.error("Failed to load zombie model:", error);
       this.createDebugMesh(); // Create placeholder on error
   }
}

// Create a simple debug mesh to represent the zombie
createDebugMesh() {
   // Create a green humanoid shape as placeholder
   const bodyGeo = new BoxGeometry(0.5, 1.0, 0.3);
   const headGeo = new BoxGeometry(0.3, 0.3, 0.3);
   const limbGeo = new BoxGeometry(0.15, 0.5, 0.15);
   
   const material = new MeshStandardMaterial({ color: new Color(0x00aa00) });
   
   // Create zombie object if it doesn't exist
   if (!this.object) {
       this.object = new Mesh();
       this.object.position.copy(this.position);
   }
   
   // Body
   const body = new Mesh(bodyGeo, material);
   body.position.y = 0.5;
   this.object.add(body);
   
   // Head
   const head = new Mesh(headGeo, material);
   head.position.y = 1.15;
   this.object.add(head);
   
   // Arms
   const leftArm = new Mesh(limbGeo, material);
   leftArm.position.set(-0.325, 0.5, 0);
   this.object.add(leftArm);
   
   const rightArm = new Mesh(limbGeo, material);
   rightArm.position.set(0.325, 0.5, 0);
   this.object.add(rightArm);
   
   // Legs
   const leftLeg = new Mesh(limbGeo, material);
   leftLeg.position.set(-0.2, -0.25, 0);
   this.object.add(leftLeg);
   
   const rightLeg = new Mesh(limbGeo, material);
   rightLeg.position.set(0.2, -0.25, 0);
   this.object.add(rightLeg);
   
   // Create a simple mixer if needed
   if (!this.mixer) {
       this.mixer = new AnimationMixer(this.object);
   }
   
   // Add to scene
   this.engine.renderer.scene.add(this.object);
   
   console.log("Created debug mesh for zombie");
}

update(deltaTime) {
   // Skip if disabled or not initialized
   if (!this.enabled || !this.object) return;
   
   // Update animation mixer
   if (this.mixer) {
       this.mixer.update(deltaTime);
   }
   
   // NOTE: SkeletonHelper doesn't need to be updated manually
   
   // Update position from physics
   this.position.copy(this.physicsBody.position);
   
   // Apply position to model
   this.object.position.copy(this.position);
   
   // Update state timers
   this.timeSinceLastStateChange += deltaTime;
   
   // Process AI behavior based on current state
   switch (this.state) {
       case 'idle':
           this.processIdleState(deltaTime);
           break;
       case 'chase':
           this.processChaseState(deltaTime);
           break;
       case 'attack':
           this.processAttackState(deltaTime);
           break;
       case 'death':
           this.processDeathState(deltaTime);
           break;
   }
   
   // Check if zombie is dead
   if (this.health <= 0 && this.state !== 'death') {
       this.changeState('death');
   }
}

processIdleState(deltaTime) {
   // Check if player is within detection range
   const player = this.engine.player;
   if (!player) return;
   
   const distanceToPlayer = this.position.distanceTo(player.position);
   
   if (distanceToPlayer < this.detectionRange) {
       // Player detected, start chasing
       this.changeState('chase');
   }
   
   // Occasionally change rotation to look around
   if (Math.random() < 0.01) {
       const randomAngle = Math.random() * Math.PI * 2;
       this.rotation.y = randomAngle;
       this.object.rotation.y = randomAngle;
   }
}

processChaseState(deltaTime) {
   const player = this.engine.player;
   if (!player) return;
   
   // Calculate distance to player
   const distanceToPlayer = this.position.distanceTo(player.position);
   
   // If player is out of detection range, go back to idle
   if (distanceToPlayer > this.detectionRange * 1.5) {
       this.changeState('idle');
       return;
   }
   
   // If close enough to attack
   if (distanceToPlayer < this.attackRange) {
       this.changeState('attack');
       return;
   }
   
   // Move towards player
   const direction = new Vector3()
       .subVectors(player.position, this.position)
       .normalize();
       
   // Set rotation to face player
   this.lookAt(player.position);
   
   // Determine speed based on distance
   let speed = this.speed.walk;
   if (distanceToPlayer < this.detectionRange * 0.5) {
       speed = this.speed.run; // Run when closer
   }
   
   // Apply movement force
   const moveForce = direction.clone().multiplyScalar(speed * 60 * deltaTime);
   this.physicsBody.velocity.x = moveForce.x;
   this.physicsBody.velocity.z = moveForce.z;
   
   // Update animation based on speed
   if (speed === this.speed.run) {
       this.playAnimation('run');
   } else {
       this.playAnimation('walk');
   }
}

processAttackState(deltaTime) {
   const player = this.engine.player;
   if (!player) return;
   
   // Calculate distance to player
   const distanceToPlayer = this.position.distanceTo(player.position);
   
   // If player moved away, go back to chase
   if (distanceToPlayer > this.attackRange * 1.2) {
       this.changeState('chase');
       return;
   }
   
   // Face the player
   this.lookAt(player.position);
   
   // Attack cooldown
   const currentTime = performance.now() / 1000;
   if (currentTime - this.lastAttackTime > this.attackCooldown) {
       this.lastAttackTime = currentTime;
       this.attack(player);
       
       // Play attack animation
       this.playAnimation('attack', false); // non-looping attack animation
   }
}

processDeathState(deltaTime) {
   // Death animation played once
   if (this.timeSinceLastStateChange > 2.0 && this.isAlive) {
       this.isAlive = false;
       
       // Start removing the zombie after a delay
       setTimeout(() => {
           // Request removal
           if (this.engine.entityManager) {
               this.engine.entityManager.removeEntity(this);
           }
       }, 3000);
   }
}

attack(player) {
   // Deal damage to player
   if (player.takeDamage) {
       player.takeDamage(this.damage);
   }
   console.log("Zombie attacks player for", this.damage, "damage!");
}

takeDamage(amount) {
   if (!this.isAlive) return;
   
   this.health -= amount;
   console.log(`Zombie took ${amount} damage. Health: ${this.health}`);
   
   // Check if zombie died
   if (this.health <= 0) {
       this.changeState('death');
   }
}

changeState(newState) {
   // Skip if already in this state
   if (newState === this.state) return;
   
   // Update state
   const prevState = this.state;
   this.state = newState;
   this.timeSinceLastStateChange = 0;
   
   // Perform state-specific transitions
   switch (newState) {
       case 'idle':
           this.playAnimation('idle');
           break;
       case 'chase':
           this.playAnimation(Math.random() < 0.5 ? 'run' : 'walk');
           break;
       case 'attack':
           this.playAnimation('attack', false);
           break;
       case 'death':
           this.playAnimation('death', false);
           // Stop movement
           this.physicsBody.velocity.set(0, 0, 0);
           break;
   }
   
   // Debug log
   console.log(`Zombie state changed: ${prevState} -> ${newState}`);
}

playAnimation(name, loop = true) {
   // Skip if no mixer or animation doesn't exist
   if (!this.mixer) {
       console.warn("Cannot play animation - mixer not initialized");
       return;
   }
   
   const clip = this.animations[name];
   if (!clip) {
       console.warn(`Animation '${name}' not found for zombie`);
       return;
   }
   
   // Stop any current animation with a short blend
   if (this.currentAnimation) {
       this.currentAnimation.fadeOut(0.2);
   }
   
   // Create new action
   this.currentAnimation = this.mixer.clipAction(clip);
   this.currentAnimation.reset();
   this.currentAnimation.loop = loop ? LoopRepeat : LoopOnce;
   this.currentAnimation.clampWhenFinished = !loop;
   this.currentAnimation.timeScale = 1.0; // Normal speed
   this.currentAnimation.fadeIn(0.2);
   this.currentAnimation.play();
   
   console.log(`Playing zombie animation: ${name}`);
}

lookAt(target) {
   // Calculate direction to target
   const direction = new Vector3()
       .subVectors(target, this.position)
       .normalize();
       
   // Only rotate on Y axis (horizontal plane)
   this.rotation.y = Math.atan2(direction.x, direction.z);
   this.object.rotation.y = this.rotation.y;
}

destroy() {
   // Clean up resources
   
   // Remove skeleton helper if it exists
   if (this.skeletonHelper) {
       this.engine.renderer.scene.remove(this.skeletonHelper);
   }
   
   // Remove from scene
   if (this.object) {
       this.engine.renderer.scene.remove(this.object);
   }
   
   // Remove physics body
   if (this.physicsBody) {
       this.engine.physics.removeBody(this.physicsBody);
   }
   
   // Dispose animations
   if (this.mixer) {
       this.mixer.stopAllAction();
   }
}
}