# Multi-Tier Autoscaling for Cloud-Native Microservices on AWS EKS

[![Infrastructure](https://img.shields.io/badge/IaC-Terraform-623CE4?style=flat-square&logo=terraform)](https://www.terraform.io/)
[![Orchestration](https://img.shields.io/badge/EKS-Kubernetes_1.30-326CE5?style=flat-square&logo=kubernetes)](https://aws.amazon.com/eks/)
[![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub_Actions_OIDC-2088FF?style=flat-square&logo=github-actions)](https://github.com/features/actions)
[![Observability](https://img.shields.io/badge/Monitoring-Prometheus_%26_Grafana-E6522C?style=flat-square&logo=prometheus)](https://prometheus.io/)
[![License](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](LICENSE)

> **Course Project:** Distributed Computing Systems (*Hệ tính toán phân bố*)  
> **Topic:** Deployment and Performance Evaluation of Cloud-Native Microservices with Multi-Tier Autoscaling on AWS.

---

## 1. Abstract & Problem Statement

In distributed microservices architectures, reactive autoscaling based solely on hardware utilization (such as CPU or Memory) often fails to capture user-perceived latency degradation during sudden traffic spikes. Due to thread pool contention, I/O wait times on downstream databases, and garbage collection pauses, tail latency ($p_{95}$, $p_{99}$) frequently violates Service Level Objectives (SLOs) long before CPU thresholds are breached.

This project designs, provisions, and evaluates a **multi-tier autoscaling architecture** on **Amazon EKS**:
1. **Pod-level Horizontal Scaling (HPA):** Driven by real-time application throughput (**Requests Per Second - RPS**) exposed via the Kubernetes Custom Metrics API and Prometheus Adapter, grounded in **Little's Law** ($L = \lambda W$).
2. **Node-level Infrastructure Scaling:** Managed by the **Kubernetes Cluster Autoscaler** interacting with AWS EC2 Auto Scaling Groups when unschedulable pods enter the `Pending` state.

---

## 2. System Architecture

When rendered on GitHub, the diagram below illustrates the target cloud-native topology provisioned across two Availability Zones on AWS:

```mermaid
graph TD
    Client([k6 Load Generator / Clients]) -->|HTTPS / HTTP| ALB[AWS Application Load Balancer]

    subgraph AWS_VPC [AWS VPC - Multi-AZ]
        ALB --> Ingress[AWS Load Balancer Controller]

        subgraph EKS [Amazon EKS Cluster - Private Subnets]
            Ingress --> UI[UI Service - Java]
            UI --> Catalog[Catalog Service - Go]
            UI --> Cart[Cart Service - Java]
            UI --> Checkout[Checkout Service - Node.js]
            Checkout --> Orders[Orders Service - Java]

            Prom[Prometheus & Adapter] -.->|Scrape /metrics| UI
            Prom -.->|Custom Metrics API: RPS| HPA[Horizontal Pod Autoscaler]
            HPA -->|Scale Replicas| UI
            HPA -->|Scale Replicas| Catalog
            CA[Cluster Autoscaler] -->|Watch Pending Pods| ASG[EC2 Managed Node Group]
        end

        subgraph Data_Tier [Managed Persistence Layer - Private Subnets]
            Catalog --> RDS_Cat[(Amazon RDS MySQL)]
            Orders --> RDS_Ord[(Amazon RDS PostgreSQL)]
            Cart --> DDB[(Amazon DynamoDB)]
            Checkout --> Redis[(Amazon ElastiCache Redis)]
        end
    end
