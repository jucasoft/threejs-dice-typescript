import {Body, ConvexPolyhedron, Vec3, World} from 'cannon';
import {
  Color,
  Face3,
  FlatShading,
  Geometry,
  Mesh,
  MeshPhongMaterial,
  Shading,
  Sphere,
  Texture,
  Vector2,
  Vector3,
} from 'three';

export class DiceObjectOpt {
  public size?: number;
  public fontColor?: string;
  public backColor?: string;
}

export interface IMaterialOptions {
  color: number;
  shading: Shading;
  shininess: number;
  specular: number;
}

export interface IDiceObject {}

export class DiceObject implements IDiceObject {
  // todo: viene settato dal metodo DiceManager.prepareValues

  // @ts-ignore
  public simulationRunning: boolean;

  // TODO verificare se questa variabile è possibile metterla da altre parti.
  protected values: number = 0;
  protected scaleFactor: number = 0;
  protected vertices: number[][] = [];
  protected textMargin: number = 0;
  // @ts-ignore
  protected faces;
  // @ts-ignore
  protected chamfer;
  // @ts-ignore
  protected tab;
  // @ts-ignore
  protected af;
  protected faceTexts: string[] = [];
  // TODO questa funzione custom va sostituita con un sistema si sovrascrizione
  // @ts-ignore
  // protected customTextTextureFunction: (text: string[], color: string, backColor: string) => Texture;
  // @ts-ignore
  protected mass: number;
  // @ts-ignore
  protected inertia: number;

  private world: World;
  private object: any;
  // TODO questi tre attibuti sono le options passate nel costruttore.
  protected size: number;
  protected labelColor: string;
  protected diceColor: string;
  protected invertUpside: boolean = false;
  protected materialOptions: IMaterialOptions;

  constructor(options: DiceObjectOpt, world: World) {

    this.world = world;

    const defaultOpt: DiceObjectOpt = {
      backColor: '#ffffff',
      fontColor: '#000000',
      size: 100,
    };

    options = {...defaultOpt, ...options};

    // todo: useless assignment
    this.object = null;
    this.size = options.size as number;
    this.labelColor = options.fontColor as string;
    this.diceColor = options.backColor as string;

    // todo: useless assignment
    this.invertUpside = false;

    this.materialOptions = {
      color: 0xf0f0f0,
      shading: FlatShading,
      shininess: 40,
      specular: 0x172022,
    };

    this.init();
    this.create();
  }

  public isFinished(): boolean {
    // console.log('DiceObject.isFinished()');
    const threshold = 1;

    const angularVelocity = this.object.body.angularVelocity;
    const velocity = this.object.body.velocity;

    const testA = Math.abs(angularVelocity.x) < threshold;
    const testB = Math.abs(angularVelocity.y) < threshold;
    const testC = Math.abs(angularVelocity.z) < threshold;
    const testD = Math.abs(velocity.x) < threshold;
    const testE = Math.abs(velocity.y) < threshold;
    const testF = Math.abs(velocity.z) < threshold;

    // console.log('testA: ' + testA);
    // console.log('testB: ' + testB);
    // console.log('testC: ' + testC);
    // console.log('testD: ' + testD);
    // console.log('testE: ' + testE);
    // console.log('testF: ' + testF);
    const result = testA && testB && testC && testD && testE && testF;
    // console.log('result', result);
    return result;
  }

  public getUpsideValue(): number {
    const vector = new Vector3(0, this.invertUpside ? -1 : 1);
    let closestFace;
    let closestAngle = Math.PI * 2;

    // tslint:disable-next-line:prefer-for-of
    for (let i = 0; i < this.object.geometry.faces.length; ++i) {
      const face = this.object.geometry.faces[i];
      if (face.materialIndex === 0) {
        continue;
      }

      const angle = face.normal.clone().applyQuaternion(this.object.body.quaternion).angleTo(vector);
      if (angle < closestAngle) {
        closestAngle = angle;
        closestFace = face;
      }
    }

    return closestFace.materialIndex - 1;
  }

  public getCurrentVectors() {
    return {
      angularVelocity: this.object.body.angularVelocity.clone(),
      position: this.object.body.position.clone(),
      quaternion: this.object.body.quaternion.clone(),
      velocity: this.object.body.velocity.clone(),
    };
  }

  // TODO tipizzare vectors
  public setVectors(vectors: any) {
    this.object.body.position = vectors.position;
    this.object.body.quaternion = vectors.quaternion;
    this.object.body.velocity = vectors.velocity;
    this.object.body.angularVelocity = vectors.angularVelocity;
  }

  public shiftUpperValue(toValue: number) {
    const geometry = this.object.geometry.clone();

    const fromValue = this.getUpsideValue();

    for (let i = 0, l = geometry.faces.length; i < l; ++i) {
      let materialIndex = geometry.faces[i].materialIndex;
      if (materialIndex === 0) {
        continue;
      }

      materialIndex += toValue - fromValue - 1;
      while (materialIndex > this.values) {
        materialIndex -= this.values;
      }
      while (materialIndex < 1) {
        materialIndex += this.values;
      }

      geometry.faces[i].materialIndex = materialIndex + 1;
    }

    this.object.geometry = geometry;
  }

  public getChamferGeometry(vectors: any[], faces: any, chamfer: any) {
    const chamferVectors = [];
    const chamferFaces = [];
    const cornerFaces = new Array(vectors.length);
    for (let i = 0; i < vectors.length; ++i) {
      cornerFaces[i] = [];
    }
    // tslint:disable-next-line:prefer-for-of
    for (let i = 0; i < faces.length; ++i) {
      const ii = faces[i];
      const fl = ii.length - 1;
      const centerPoint = new Vector3();
      const face = new Array(fl);
      for (let j = 0; j < fl; ++j) {
        const vv = vectors[ii[j]].clone();
        centerPoint.add(vv);
        cornerFaces[ii[j]].push(face[j] = chamferVectors.push(vv) - 1);
      }
      centerPoint.divideScalar(fl);
      for (let j = 0; j < fl; ++j) {
        const vv = chamferVectors[face[j]];
        vv.subVectors(vv, centerPoint).multiplyScalar(chamfer).addVectors(vv, centerPoint);
      }
      face.push(ii[fl]);
      chamferFaces.push(face);
    }

    for (let i = 0; i < faces.length - 1; ++i) {
      for (let j = i + 1; j < faces.length; ++j) {
        const pairs = [];
        let lastm = -1;
        for (let m = 0; m < faces[i].length - 1; ++m) {
          const n = faces[j].indexOf(faces[i][m]);
          if (n >= 0 && n < faces[j].length - 1) {
            if (lastm >= 0 && m !== lastm + 1) {
              pairs.unshift([i, m], [j, n]);
            } else {
              pairs.push([i, m], [j, n]);
            }
            lastm = m;
          }
        }
        if (pairs.length !== 4) {
          continue;
        }
        chamferFaces.push([chamferFaces[pairs[0][0]][pairs[0][1]],
          chamferFaces[pairs[1][0]][pairs[1][1]],
          chamferFaces[pairs[3][0]][pairs[3][1]],
          chamferFaces[pairs[2][0]][pairs[2][1]], -1]);
      }
    }

    // tslint:disable-next-line:prefer-for-of
    for (let i = 0; i < cornerFaces.length; ++i) {
      const cf = cornerFaces[i];
      const face = [cf[0]];
      let count = cf.length - 1;
      while (count) {
        for (let m = faces.length; m < chamferFaces.length; ++m) {
          let index = chamferFaces[m].indexOf(face[face.length - 1]);
          if (index >= 0 && index < 4) {
            if (--index === -1) {
              index = 3;
            }
            const nextVertex = chamferFaces[m][index];
            if (cf.indexOf(nextVertex) >= 0) {
              face.push(nextVertex);
              break;
            }
          }
        }
        --count;
      }
      face.push(-1);
      chamferFaces.push(face);
    }
    return {vectors: chamferVectors, faces: chamferFaces};
  }

  public makeGeometry(vertices: any[], faces: any, radius: any, tab: any, af: any): Geometry {
    const geom = new Geometry();
    vertices.forEach((vertice) => {
      const vertex = vertice.multiplyScalar(radius);
      vertex.index = geom.vertices.push(vertex) - 1;
    });

    faces.forEach((face: any) => {
      const ii = face;
      const fl = ii.length - 1;
      const aa = Math.PI * 2 / fl;
      const color = new Color(0x000000);
      for (let j = 0; j < fl - 2; ++j) {
        geom.faces.push(new Face3(ii[0], ii[j + 1], ii[j + 2], [geom.vertices[ii[0]],
          geom.vertices[ii[j + 1]], geom.vertices[ii[j + 2]]], color, ii[fl] + 1));
        geom.faceVertexUvs[0].push([
          new Vector2((Math.cos(af) + 1 + tab) / 2 / (1 + tab),
            (Math.sin(af) + 1 + tab) / 2 / (1 + tab)),
          new Vector2((Math.cos(aa * (j + 1) + af) + 1 + tab) / 2 / (1 + tab),
            (Math.sin(aa * (j + 1) + af) + 1 + tab) / 2 / (1 + tab)),
          new Vector2((Math.cos(aa * (j + 2) + af) + 1 + tab) / 2 / (1 + tab),
            (Math.sin(aa * (j + 2) + af) + 1 + tab) / 2 / (1 + tab))]);
      }
    });

    geom.computeFaceNormals();
    geom.boundingSphere = new Sphere(new Vector3(), radius);
    return geom;
  }

  public createShape(vertices: any[], faces: any[], radius: any) {
    const cv = new Array(vertices.length);
    const cf = new Array(faces.length);
    vertices.forEach((v, i) => {
      cv[i] = new Vec3(v.x * radius, v.y * radius, v.z * radius);
    });
    faces.forEach((face, i) => {
      cf[i] = face.slice(0, face.length - 1);
    });

    return new ConvexPolyhedron(cv, cf);
  }

  public getGeometry() {
    const radius = this.size * this.scaleFactor;

    const vectors = new Array(this.vertices.length);
    this.vertices.forEach((vertice, i) => {
      vectors[i] = (new Vector3()).fromArray(vertice).normalize();
    });

    const chamferGeometry = this.getChamferGeometry(vectors, this.faces, this.chamfer);
    const geometry = this.makeGeometry(chamferGeometry.vectors, chamferGeometry.faces, radius, this.tab, this.af);
    // todo, da verificare assegnazione di questo attributo.
    (geometry as any).cannon_shape = this.createShape(vectors, this.faces, radius);

    return geometry;
  }

  public calculateTextureSize(approx: number): number {
    return Math.max(128, Math.pow(2, Math.floor(Math.log(approx) / Math.log(2))));
  }

  protected createTextTexture(text: string, color: string, backColor: string): Texture {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d') as CanvasRenderingContext2D;
    const ts = this.calculateTextureSize(this.size / 2 + this.size * this.textMargin) * 2;
    canvas.width = canvas.height = ts;
    context.font = ts / (1 + 2 * this.textMargin) + 'pt Arial';
    context.fillStyle = backColor;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = color;
    context.fillText(text, canvas.width / 2, canvas.height / 2);
    const texture = new Texture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  protected getMaterials(): MeshPhongMaterial[] {
    const materials: MeshPhongMaterial[] = this.faceTexts.map((faceTextItem: string) => {
      const texture = this.createTextTexture(faceTextItem, this.labelColor, this.diceColor);
      return new MeshPhongMaterial(Object.assign({}, this.materialOptions, {map: texture}));
    });
    return materials;
  }

  public getObject() {
    return this.object;
  }

  private create() {
    // console.log('DiceObject.create()');
    if (!this.world) {
      throw new Error('You must call DiceManager.setWorld(world) first.');
    }
    this.object = new Mesh(this.getGeometry(), this.getMaterials());

    this.object.reveiceShadow = true;
    this.object.castShadow = true;
    this.object.diceObject = this;
    this.object.body = new Body({
      mass: this.mass,
      // todo: questo valore va recuperato dal DiceManager
      // @ts-ignore
      material: this.diceBodyMaterial,
      shape: this.object.geometry.cannon_shape,
    });
    this.object.body.linearDamping = 0.1;
    this.object.body.angularDamping = 0.1;
    // todo: il metodo add non esiste.
    (this.world as any).add(this.object.body);

    return this.object;
  }

  public updateMeshFromBody() {
    if (!this.simulationRunning) {
      this.object.position.copy(this.object.body.position);
      this.object.quaternion.copy(this.object.body.quaternion);
    }
  }

  public updateBodyFromMesh() {
    this.object.body.position.copy(this.object.position);
    this.object.body.quaternion.copy(this.object.quaternion);
  }

  protected init() {
    throw new Error('method to overwrite');
  }

  private emulateThrow(callback: (value: number) => void) {
    let stableCount = 0;

    const check = () => {
      if (this.isFinished()) {
        stableCount++;

        if (stableCount === 50) {
          this.world.removeEventListener('postStep', check);
          callback(this.getUpsideValue());
        }
      } else {
        stableCount = 0;
      }

      this.world.step(this.world.dt);
    };

    this.world.addEventListener('postStep', check);
  }

}
