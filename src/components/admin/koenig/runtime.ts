// All runtime imports come from Koenig's bundled instance, never another Lexical.
export {
  KoenigLexical as L,
  KoenigHtml as Html,
  KoenigReact as LexicalReact,
  KoenigSelection as Selection,
  KoenigRichText as RichText,
  KoenigList as List,
  KoenigLink as Link,
  $selectDecoratorNode as selectCard,
} from "@tryghost/koenig-lexical";

export type { LexicalEditor, LexicalNode, EditorState, BaseSelection } from "lexical";
