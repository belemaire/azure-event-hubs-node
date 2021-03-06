// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import * as Constants from "./util/constants";

import {
  Message, MessageProperties, MessageHeader, EventHubMessageAnnotations, Dictionary
} from "./rhea-promise";

/**
 * Describes the structure of an event to be sent or received from the EventHub.
 * @interface EventData
 */
export interface EventData {
  /**
   * @property {MessageHeader} [header] - The message headers.
   */
  header?: MessageHeader;
  /**
   * @property {any} body - The message body that needs to be sent or is received.
   */
  body: any;
  /**
   * @property {Date} [enqueuedTimeUtc] The enqueued time of the event.
   */
  enqueuedTimeUtc?: Date;
  /**
   * @property {string | null} [partitionKey] If specified EventHub will hash this to a partitionId.
   * It guarantees that messages end up in a specific partition on the event hub.
   */
  partitionKey?: string | null;
  /**
   * @property {string} [offset] The offset of the event.
   */
  offset?: string;
  /**
   * @property {number} [sequenceNumber] The sequence number of the event.
   */
  sequenceNumber?: number;
  /**
   * @property {AmqpMessageAnnotations} [annotations] The amqp message attributes.
   */
  annotations?: EventHubMessageAnnotations;
  /**
   * @property {AmqpMessageProperties} [properties] The predefined AMQP properties like message_id, correlation_id, reply_to, etc.
   */
  properties?: MessageProperties;
  /**
   * @property {Dictionary<any>} [applicationProperties] The application specific properties.
   */
  applicationProperties?: Dictionary<any>;
  /**
   * @property {number} [lastSequenceNumber] The last sequence number of the event within the partition stream of the Event Hub.
   */
  lastSequenceNumber?: number;
  /**
   * @property {string} [lastEnqueuedOffset] The offset of the last enqueued event.
   */
  lastEnqueuedOffset?: string;
  /**
   * @property {Date} [lastEnqueuedTime] The enqueued UTC time of the last event.
   */
  lastEnqueuedTime?: Date;
  /**
   * @property {Date} [retrievalTime] The time when the runtime info was retrieved
   */
  retrievalTime?: Date;
  /**
   * @property {AmqpMessage} _raw_amqp_mesage The underlying raw amqp message.
   */
  _raw_amqp_mesage?: Message;
}

export const messageProperties: string[] = [
  "message_id", "reply_to", "to", "correlation_id", "content_type", "absolute_expiry_time",
  "group_id", "group_sequence", "reply_to_group_id", "content_encoding", "creation_time", "subject",
  "user_id"
];

export const messageHeader: string[] = [
  "first_acquirer", "delivery_count", "ttl", "durable", "priority"
];

/**
 * Describes the methods on the EventData interface.
 * @module EventData
 */
export namespace EventData {

  /**
   * Converts the AMQP message to an EventData.
   * @param {AmqpMessage} msg The AMQP message that needs to be converted to EventData.
   */
  export function fromAmqpMessage(msg: Message): EventData {
    const data: EventData = {
      body: msg.body,
      _raw_amqp_mesage: msg
    };
    if (msg.message_annotations) {
      data.annotations = msg.message_annotations;
      if (msg.message_annotations[Constants.partitionKey]) data.partitionKey = msg.message_annotations[Constants.partitionKey];
      if (msg.message_annotations[Constants.sequenceNumber]) data.sequenceNumber = msg.message_annotations[Constants.sequenceNumber];
      if (msg.message_annotations[Constants.enqueuedTime]) data.enqueuedTimeUtc = new Date(msg.message_annotations[Constants.enqueuedTime] as number);
      if (msg.message_annotations[Constants.offset]) data.offset = msg.message_annotations[Constants.offset];
    }
    // Since rhea expects message properties as top level properties we will look for them and unflatten them inside properties.
    for (const prop of messageProperties) {
      if ((msg as any)[prop] !== undefined) {
        if (!data.properties) {
          data.properties = {};
        }
        (data.properties as any)[prop] = (msg as any)[prop];
      }
    }
    // Since rhea expects message headers as top level properties we will look for them and unflatten them inside header.
    for (const prop of messageHeader) {
      if ((msg as any)[prop] !== undefined) {
        if (!data.header) {
          data.header = {};
        }
        (data.header as any)[prop] = (msg as any)[prop];
      }
    }
    if (msg.application_properties) {
      data.applicationProperties = msg.application_properties;
    }
    if (msg.delivery_annotations) {
      data.lastEnqueuedOffset = msg.delivery_annotations.last_enqueued_offset;
      data.lastSequenceNumber = msg.delivery_annotations.last_enqueued_sequence_number;
      data.lastEnqueuedTime = new Date(msg.delivery_annotations.last_enqueued_time_utc as number);
      data.retrievalTime = new Date(msg.delivery_annotations.runtime_info_retrieval_time_utc as number);
    }
    return data;
  }

  /**
   * Converts an EventData object to an AMQP message.
   * @param {EventData} data The EventData object that needs to be converted to an AMQP message.
   */
  export function toAmqpMessage(data: EventData): Message {
    const msg: Message = {
      body: data.body,
    };
    // As per the AMQP 1.0 spec If the message-annotations or delivery-annotations section is omitted,
    // it is equivalent to a message-annotations section containing anempty map of annotations.
    msg.message_annotations = {};
    msg.delivery_annotations = {};
    if (data.annotations) {
      msg.message_annotations = data.annotations;
    }
    if (data.properties) {
      // Set amqp message properties as top level properties, since rhea sends them as top level properties.
      for (const prop in data.properties) {
        (msg as any)[prop] = (data.properties as any)[prop];
      }
    }
    if (data.applicationProperties) {
      msg.application_properties = data.applicationProperties;
    }
    if (data.partitionKey) {
      msg.message_annotations[Constants.partitionKey] = data.partitionKey;
      // Event Hub service cannot route messages to a specific partition based on the partition key
      // if AMQP message header is an empty object. Hence we make sure that header is always present
      // with atleast one property. Setting durable to true, helps us achieve that.
      msg.durable = true;
    }
    if (data.sequenceNumber != undefined) {
      msg.message_annotations[Constants.sequenceNumber] = data.sequenceNumber;
    }
    if (data.enqueuedTimeUtc) {
      msg.message_annotations[Constants.enqueuedTime] = data.enqueuedTimeUtc.getTime();
    }
    if (data.offset != undefined) {
      msg.message_annotations[Constants.offset] = data.offset;
    }
    if (data.lastEnqueuedOffset != undefined) {
      msg.delivery_annotations.last_enqueued_offset = data.lastEnqueuedOffset;
    }
    if (data.lastSequenceNumber != undefined) {
      msg.delivery_annotations.last_enqueued_sequence_number = data.lastSequenceNumber;
    }
    if (data.lastEnqueuedTime) {
      msg.delivery_annotations.last_enqueued_time_utc = data.lastEnqueuedTime.getTime();
    }
    if (data.retrievalTime) {
      msg.delivery_annotations.runtime_info_retrieval_time_utc = data.retrievalTime.getTime();
    }

    if (data.header) {
      // Set amqp message header as top level properties, since rhea expects them as top level properties.
      for (const prop in data.header) {
        (msg as any)[prop] = (data.header as any)[prop];
      }
    }

    return msg;
  }
}
