export { defaultClientName, isPhoneBasedChannel } from "./domain";
export type {
  IncomingMessage,
  MessageReceiver,
  MessageSender,
  OutgoingAttachment,
  OutgoingMessage,
  SendResult,
} from "./domain";
export {
  ConsoleAdapter,
  isValidMetaSignature,
  loadWhatsAppConfig,
  MissingWhatsAppCredentialsError,
  WhatsAppAdapter,
} from "./adapters";
export type { ConsoleSentMessage, WhatsAppConfig, WhatsAppSendResult } from "./adapters";
export { attachChannel, receiveMessage } from "./service";
