import {ContactMaterial, Material, World} from 'cannon';

export class DiceManager {
  private world: World;
  private throwRunning = false;

  // @ts-ignore
  public diceBodyMaterial;
  // @ts-ignore
  public floorBodyMaterial;
  // @ts-ignore
  public barrierBodyMaterial;

  constructor(world: World) {
    this.world = world;
    this.init();
  }

  /**
   *
   * @param {array} diceValues
   * @param {DiceObject} [diceValues.dice]
   * @param {number} [diceValues.value]
   *
   */
  public prepareValues(diceValues: any[]) {
    if (this.throwRunning) {
      throw new Error('Cannot start another throw. Please wait, till the current throw is finished.');
    }

    diceValues.forEach((diceValue) => {
      if (diceValue.value < 1 || diceValue.dice.values < diceValue.value) {
        throw new Error('Cannot throw die to value ' + diceValue.value + ', because it has only ' + diceValue.dice.values + ' sides.');
      }
    });

    this.throwRunning = true;

    diceValues.forEach((diceValue) => {
      diceValue.dice.simulationRunning = true;
      diceValue.vectors = diceValue.dice.getCurrentVectors();
      diceValue.stableCount = 0;
    });

    const check = () => {
      let allStable = true;

      diceValues.forEach((diceValue) => {
        if (diceValue.dice.isFinished()) {
          diceValue.stableCount++;
        } else {
          diceValue.stableCount = 0;
        }

        if (diceValue.stableCount < 50) {
          allStable = false;
        }
      });

      if (allStable) {
        console.log('all stable');
        this.world.removeEventListener('postStep', check);

        diceValues.forEach((diceValue) => {
          diceValue.dice.shiftUpperValue(diceValue.value);
          diceValue.dice.setVectors(diceValue.vectors);
          diceValue.dice.simulationRunning = false;
        });

        this.throwRunning = false;
      } else {
        this.world.step(this.world.dt);
      }
    };

    this.world.addEventListener('postStep', check);
  }

  private init() {

    this.diceBodyMaterial = new Material('diceBodyMaterial');
    this.floorBodyMaterial = new Material('floorBodyMaterial');
    this.barrierBodyMaterial = new Material('barrierBodyMaterial');

    this.world.addContactMaterial(
      new ContactMaterial(this.floorBodyMaterial, this.diceBodyMaterial, {friction: 0.01, restitution: 0.5}),
    );
    this.world.addContactMaterial(
      new ContactMaterial(this.barrierBodyMaterial, this.diceBodyMaterial, {friction: 0, restitution: 1.0}),
    );
    this.world.addContactMaterial(
      new ContactMaterial(this.diceBodyMaterial, this.diceBodyMaterial, {friction: 0, restitution: 0.5}),
    );
  }

}
