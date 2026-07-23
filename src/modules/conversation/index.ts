export {
  CONVERSATION_CHANNELS,
  channelLabels,
  ConversationNotFoundError,
  formatRelativeTime,
  isConversationUnread,
  sendMessageInputSchema,
} from "./domain";
export type { ConversationChannelValue, MessageSenderValue, SendMessageInput } from "./domain";
export {
  findOrCreateConversation,
  getConversation,
  listConversations,
  listMessages,
  markAsRead,
  sendMessage,
} from "./service";
export type { ConversationDetail, ConversationListItem, MessageItem } from "./service";
