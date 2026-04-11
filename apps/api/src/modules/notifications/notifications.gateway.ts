import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

export interface ProductNotification {
  type: 'product.created' | 'product.updated' | 'product.deleted';
  product: {
    id: string;
    name: string;
    slug: string;
    price: number;
    image?: string;
    categoryId?: string;
    categoryName?: string;
  };
  timestamp: Date;
}

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/notifications',
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(NotificationsGateway.name);
  private connectedClients = new Map<string, Socket>();

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    this.connectedClients.set(client.id, client);

    // Send welcome message
    client.emit('connected', {
      message: 'Connected to notifications server',
      clientId: client.id,
    });
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.connectedClients.delete(client.id);
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(
    @MessageBody() data: { topics: string[] },
    @ConnectedSocket() client: Socket,
  ) {
    const { topics } = data;

    topics.forEach((topic) => {
      client.join(topic);
      this.logger.log(`Client ${client.id} subscribed to ${topic}`);
    });

    return {
      event: 'subscribed',
      data: { topics, clientId: client.id },
    };
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @MessageBody() data: { topics: string[] },
    @ConnectedSocket() client: Socket,
  ) {
    const { topics } = data;

    topics.forEach((topic) => {
      client.leave(topic);
      this.logger.log(`Client ${client.id} unsubscribed from ${topic}`);
    });

    return {
      event: 'unsubscribed',
      data: { topics, clientId: client.id },
    };
  }

  emitProductCreated(notification: ProductNotification) {
    this.logger.log(
      `Emitting product.created notification: ${notification.product.name}`,
    );
    this.server.to('products').emit('product.created', notification);
  }

  // Get connected clients count
  getConnectedClientsCount(): number {
    return this.connectedClients.size;
  }

  // Test method to verify gateway is working
  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket) {
    return {
      event: 'pong',
      data: { timestamp: new Date(), clientId: client.id },
    };
  }
}
