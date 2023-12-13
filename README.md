# Email Worker - Bank statements

Cloudflare Email Worker for Bank Statements processing

Once an email with the statement is sent from bank, worker extracts the attachment and uploads it to DropBox folder for accounting.

## Sequence diagram:

```mermaid
sequenceDiagram
    actor Bank
    actor Cloudflare Worker
    actor DropBox
    actor Email Server
    Bank->>Cloudflare Worker: sends email with bank statement
    Cloudflare Worker->>Cloudflare Worker: parse email
    Cloudflare Worker ->>DropBox: upload bank statement
    DropBox-->>Cloudflare Worker: ok    
    Cloudflare Worker->>Email Server: forward email to destination
```