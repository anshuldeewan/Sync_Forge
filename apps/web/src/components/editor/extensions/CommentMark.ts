import { Mark, mergeAttributes } from '@tiptap/core';

export interface CommentOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    comment: {
      /**
       * Set a comment mark
       */
      setComment: (commentId: string) => ReturnType;
      /**
       * Unset a comment mark
       */
      unsetComment: (commentId: string) => ReturnType;
    };
  }
}

export const CommentMark = Mark.create<CommentOptions>({
  name: 'comment',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: (element: any) => element.getAttribute('data-comment-id'),
        renderHTML: (attributes: any) => {
          if (!attributes.commentId) {
            return {};
          }
          return {
            'data-comment-id': attributes.commentId,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-comment-id]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, any> }) {
    return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { class: 'bg-yellow-200 dark:bg-yellow-900/50 rounded px-1 cursor-pointer hover:bg-yellow-300 dark:hover:bg-yellow-800' }), 0];
  },

  addCommands() {
    return {
      setComment:
        (commentId: string) =>
        ({ commands }: any) => {
          return commands.setMark(this.name, { commentId });
        },
      unsetComment:
        (commentId: string) =>
        ({ tr, dispatch }: any) => {
          if (dispatch) {
            tr.removeMark(tr.selection.from, tr.selection.to, this.type);
          }
          return true;
        },
    };
  },
});
