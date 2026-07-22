export const SAMPLE_DIAGRAM = `# Flow Diagram — describe a use case end to end.
# Components first, then one flow per scenario.

screen MyOrders "My Orders" {
  desc: "Order list with filters for client, period and integration status"
}

http GetOrders "GET /v1/orders" {
  method: GET
  path: /v1/orders
  desc: "Returns a page of orders matching the filters from the screen"
  response {
    status: 200
    payload: \`{
  "data": [
    { "checkout": "556893", "client": "SUPER MUFFATO", "status": "pending" }
  ],
  "page": 1,
  "total": 128
}\`
  }
}

service OrderService "Order Service" {
  desc: "Orchestrates order creation, lookup and integration"
}

db OrdersDB "Orders Database" {
  desc: "Source of truth for campaigns, orders and line items"
  table campaign {
    id bigint [pk]
    code varchar(10) [not null]
    name varchar(244) [not null]
  }
  table order {
    id bigint [pk]
    campaign_id bigint [fk]
    status varchar(32) [not null]
    gross_value decimal(12,2)
  }
  table line_item {
    id bigint [pk]
    order_id bigint [fk]
    quantity int [not null]
  }
  ref: order.campaign_id > campaign.id
  ref: line_item.order_id > order.id
}

topic OrderEvents "order.events" {
  broker: kafka
  desc: "Status changes published for downstream consumers"
  payload: \`{
  "event_id": "evt_9f21",
  "type": "order.status_changed",
  "order_id": 556893,
  "status": "received"
}\`
}

service IntegrationService "Integration Service" {
  desc: "Consumes events and syncs orders with partner systems"
}

http SyncOrder "POST /crm/orders" {
  method: POST
  path: /crm/orders
  desc: "Pushes a synced order to the partner CRM"
  request {
    payload: \`{
  "order_id": 556893,
  "client": "SUPER MUFFATO",
  "gross_value": 625255.36
}\`
  }
  response {
    status: 200
    payload: \`{ "crm_id": "CRM-88421", "status": "synced" }\`
  }
}

service PartnerCRM "Partner CRM" {
  external: true
  desc: "Third-party CRM that receives the synced orders"
}

flow Lookup "Order lookup" {
  MyOrders -> GetOrders : "request"
  GetOrders -> OrderService
  OrderService -> OrdersDB : "query"
}

flow CrmSync "CRM synchronisation" {
  OrderService -> OrderEvents : "publish"
  OrderEvents -> IntegrationService : "consume"
  IntegrationService -> SyncOrder
  SyncOrder -> PartnerCRM : "sync"
}
`;
