variable "aws_region" { type = string }
variable "name_prefix" { type = string }
variable "vpc_cidr" { type = string }
variable "azs" { type = list(string) }
variable "public_subnet_cidrs" { type = list(string) }
variable "private_subnet_cidrs" { type = list(string) }
variable "ecr_repositories" { type = list(string) }

variable "active_backend" {
  description = "Backend service exposed through the shared /api/* and /uploads/* routes"
  type        = string
  default     = "api-spring"

  validation {
    condition     = contains(["api-node", "api-python", "api-spring"], var.active_backend)
    error_message = "active_backend must be one of api-node, api-python, or api-spring."
  }
}

variable "services" {
  type = map(object({
    cpu            = number
    memory         = number
    container_port = number
    desired_count  = number
    image          = string
    environment    = map(string)
    command        = optional(list(string))
    priority       = number
    path_patterns  = list(string)
    health_check   = string
  }))
}
variable "tags" {
  type    = map(string)
  default = {}
}

variable "db_username" {
  description = "RDS master username"
  type        = string
  default     = "admin"
}

variable "db_password" {
  description = "RDS master password"
  type        = string
  sensitive   = true
}

variable "bastion_key_name" {
  description = "Existing EC2 key pair name for Bastion SSH"
  type        = string
  default     = null
}

variable "bastion_ingress_cidrs" {
  description = "Trusted CIDRs allowed to SSH into Bastion"
  type        = list(string)
  default     = []
}

variable "bastion_instance_type" {
  description = "Bastion EC2 instance type"
  type        = string
  default     = "t3.micro"
}
