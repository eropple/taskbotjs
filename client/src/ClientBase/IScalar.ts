export interface IScalar<TType> {
  readonly key: string;

  get(): Promise<TType | null>
  set(value: TType): Promise<TType>

  delete(): Promise<boolean>;
}
