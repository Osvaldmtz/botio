import { ChatWidget } from './components/chat-widget';

type Props = { params: { botId: string } };

export default function WidgetPage({ params }: Props) {
  return (
    <div className="fixed inset-0 h-full w-full bg-white">
      <ChatWidget botId={params.botId} />
    </div>
  );
}
