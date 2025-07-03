declare module 'react-slack-chat' {
  import * as React from 'react';
  export interface ReactSlackChatProps {
    botName: string;
    apiToken: string;
    channelId: string[];
    helpText?: string;
    userImage?: string;
    debugMode?: boolean;
  }
  export class ReactSlackChat extends React.Component<ReactSlackChatProps, any> {}
}