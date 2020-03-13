class Work {
  #a: string;
  #b: number;

  constructor(a: string, b: number) {
    this.#a = a;
    this.#b = b;
  }

  doWork() {
    console.log(`Done work with "${this.#a}" and "${this.#b}"`);
  }

  async doAsyncWork() {
    return `Done work with "${this.#a}" and "${this.#b}"`
  }
}

const work = new Work('🚧', 4);

work.doWork();
