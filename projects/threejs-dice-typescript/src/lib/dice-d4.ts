import {MeshPhongMaterial, Texture} from 'three';
import {DiceObject} from './dice-object';

export class DiceD4 extends DiceObject {
  protected init() {
    this.tab = -0.1;
    this.af = Math.PI * 7 / 6;
    this.chamfer = 0.96;
    this.vertices = [[1, 1, 1], [-1, -1, 1], [-1, 1, -1], [1, -1, -1]];
    this.faces = [[1, 0, 2, 1], [0, 1, 3, 2], [0, 3, 2, 3], [1, 2, 3, 4]];
    this.scaleFactor = 1.2;
    this.values = 4;
    // nel caso dei dadi da 4 faceTexts era valorizzato in modo differente da tutti gli altri dadi.
    // evito questa difformità mettendo il valore direttamente nella funzione "createTextTexture" che viene sovrascritta.
    this.faceTexts = [];
    this.mass = 300;
    this.inertia = 5;
    this.invertUpside = true;
  }

  protected customCreateTextTexture(text: string[], color: string, backColor: string): Texture {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d') as CanvasRenderingContext2D;
    const ts = this.calculateTextureSize(this.size / 2 + this.size * 2) * 2;
    canvas.width = canvas.height = ts;
    context.font = ts / 5 + 'pt Arial';
    context.fillStyle = backColor;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = color;

    text.forEach((value) => {
      context.fillText(value, canvas.width / 2, canvas.height / 2 - ts * 0.3);
      context.translate(canvas.width / 2, canvas.height / 2);
      context.rotate(Math.PI * 2 / 3);
      context.translate(-canvas.width / 2, -canvas.height / 2);
    });

    const texture = new Texture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  protected getMaterials(): MeshPhongMaterial[] {
    const localFaceTexts = [[], ['0', '0', '0'], ['2', '4', '3'], ['1', '3', '4'], ['2', '1', '4'], ['1', '2', '3']];
    const materials: MeshPhongMaterial[] = localFaceTexts.map((faceTextItem: string[]) => {
      const texture = this.customCreateTextTexture(faceTextItem, this.labelColor, this.diceColor);
      return new MeshPhongMaterial(Object.assign({}, this.materialOptions, {map: texture}));
    });
    return materials;
  }

}
