export interface UseCase<Command, Result> {
  execute(command: Command): Promise<Result>;
}
