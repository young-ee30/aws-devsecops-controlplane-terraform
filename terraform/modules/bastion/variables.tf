variable "name_prefix" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "public_subnet_id" {
  type = string
}

variable "allowed_ssh_cidrs" {
  type = list(string)
}

variable "key_name" {
  type    = string
  default = null
}

variable "instance_type" {
  type    = string
  default = "t3.micro"
}

variable "tags" {
  type    = map(string)
  default = {}
}
