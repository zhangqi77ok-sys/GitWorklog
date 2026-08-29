import { searchFuzzyMentions, MentionSearchResultItem } from '../types/contracts';

export class MentionEngine {
  public query(inputText: string): MentionSearchResultItem[] {
    return searchFuzzyMentions(inputText);
  }
}

export const defaultMentionEngine = new MentionEngine();
