variable "name_prefix" {
  type = string
}

variable "vpc_cidr" {
  type = string
}

variable "azs" {
  type = list(string)
}

variable "public_subnet_cidrs" {
  type = list(string)
}

variable "private_subnet_cidrs" {
  type = list(string)
}

variable "flow_log_retention_in_days" {
  description = "VPC Flow Log CloudWatch 보관 주기 (일). 비용 절감을 위해 짧게 유지"
  type        = number
  default     = 14
}

variable "tags" {
  type    = map(string)
  default = {}
}
